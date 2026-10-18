// Xử lý sự kiện Slack Events API — hiện chỉ `app_mention` (người dùng gõ `@DocMind <câu hỏi>`).
//
// Khác /ask: người dùng tự viết câu hỏi trong channel/thread nên KHÔNG đăng lại câu hỏi; bot trả lời ngay
// trong thread của tin nhắn đó (thread_ts = thread hiện có, hoặc chính tin nhắn mention nếu là tin gốc).
// Lỗi/hướng dẫn gửi dạng ephemeral (chat.postEphemeral) vì sự kiện không có response_url.
//
// 4.6b: mention TRONG thread có sẵn -> đọc lịch sử thread từ Slack (conversations.replies), viết lại câu hỏi
// thành câu độc lập (QuestionCondenserService) rồi mới tìm kiếm. Mention ở tin gốc -> câu hỏi đầu, không tốn
// thêm lượt LLM. Không đọc được thread (thiếu scope, lỗi mạng...) -> rơi về câu hỏi gốc, vẫn trả lời bình thường.
// Quyền truy cập dữ liệu: giống /ask — chỉ do mapping channel -> collection quyết định.
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { PublicQueryService } from '../public-api/public-query.service.js';
import { QuestionCondenserService } from '../public-api/question-condenser.service.js';
import { SlackApiClient } from './slack-api.client.js';
import { SlackCryptoService } from './slack-crypto.service.js';
import { RateLimitService } from '../common/rate-limit/rate-limit.service.js';
import {
  SLACK_EVENT_DEDUPE_TTL_MS,
  SLACK_TEAM_LIMIT_PER_MINUTE,
  SLACK_TEAM_LIMIT_WINDOW_MS,
  slackEventKey,
  slackTeamLimitKey,
} from './slack-limits.js';
import { buildAnswerBlocks, escapeSlackText } from './slack-mrkdwn.util.js';
import { extractQuestion } from './slack-text.util.js';
import { buildThreadHistory } from './slack-thread-history.util.js';

// Giữ export cũ để import từ file này (test 4.6a) vẫn chạy.
export { extractQuestion };

const EventCallbackSchema = z.object({
  type: z.literal('event_callback'),
  team_id: z.string().min(1),
  event_id: z.string().min(1),
  event: z.object({ type: z.string() }).passthrough(),
  // Với app_mention, authorizations[0].user_id là bot user id của app -> biết chính xác mention nào cần bỏ.
  authorizations: z
    .array(z.object({ user_id: z.string().optional() }).passthrough())
    .optional(),
});

const AppMentionSchema = z.object({
  type: z.literal('app_mention'),
  user: z.string().min(1),
  text: z.string(),
  channel: z.string().min(1),
  ts: z.string().min(1),
  thread_ts: z.string().optional(),
  bot_id: z.string().optional(),
});

export const SLACK_MENTION_LIMIT_PER_MINUTE = SLACK_TEAM_LIMIT_PER_MINUTE; // giữ tên cũ cho test/tương thích
const MAX_QUESTION_CHARS = 2000;
const QUESTION_TOP_K = 5;

const MSG_USAGE =
  'Hãy gõ câu hỏi sau tên bot, ví dụ: `@DocMind Quy trình xin nghỉ phép là gì?`';
const MSG_TOO_LONG = `Câu hỏi quá dài (tối đa ${MAX_QUESTION_CHARS} ký tự).`;
const MSG_ANSWER_ERROR =
  'Xin lỗi, DocMind gặp lỗi khi tìm câu trả lời. Vui lòng thử lại sau.';

@Injectable()
export class SlackEventsService {
  private readonly logger = new Logger(SlackEventsService.name);

  constructor(
    private readonly system: PrismaSystemService,
    private readonly crypto: SlackCryptoService,
    private readonly api: SlackApiClient,
    private readonly publicQuery: PublicQueryService,
    private readonly condenser: QuestionCondenserService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** Không bao giờ throw — chạy nền sau khi controller đã ack. */
  async handle(payload: unknown): Promise<void> {
    try {
      await this.process(payload);
    } catch (err) {
      this.logger.error('Unhandled error handling Slack event', err);
    }
  }

  private async process(payload: unknown): Promise<void> {
    const callback = EventCallbackSchema.safeParse(payload);
    if (!callback.success) return;
    const {
      team_id: teamId,
      event_id: eventId,
      authorizations,
    } = callback.data;

    const mention = AppMentionSchema.safeParse(callback.data.event);
    if (!mention.success) return; // loại sự kiện khác (hoặc app_mention từ bot khác): bỏ qua
    const event = mention.data;
    if (event.bot_id) return; // không trả lời bot (kể cả chính mình) để tránh vòng lặp

    if (
      !(await this.rateLimit.claimOnce(
        slackEventKey(eventId),
        SLACK_EVENT_DEDUPE_TTL_MS,
      ))
    )
      return;

    const integration = await this.system.slackIntegration.findUnique({
      where: { slackTeamId: teamId },
    });
    if (!integration) {
      this.logger.warn(`app_mention from unconnected Slack team ${teamId}`);
      return;
    }
    const token = this.crypto.decrypt(integration.accessToken);
    const threadTs = event.thread_ts ?? event.ts;
    const say = (text: string) =>
      this.ephemeral(token, event.channel, event.user, threadTs, text);

    const limit = await this.rateLimit.consume(
      slackTeamLimitKey(teamId),
      SLACK_TEAM_LIMIT_PER_MINUTE,
      SLACK_TEAM_LIMIT_WINDOW_MS,
    );
    if (!limit.allowed) {
      return say(
        `Có quá nhiều câu hỏi trong thời gian ngắn. Thử lại sau khoảng ${limit.retryAfterSeconds} giây.`,
      );
    }

    const question = extractQuestion(event.text, authorizations?.[0]?.user_id);
    if (!question) return say(MSG_USAGE);
    if (question.length > MAX_QUESTION_CHARS) return say(MSG_TOO_LONG);

    const mapping = await this.system.slackChannelMapping.findUnique({
      where: {
        slackIntegrationId_slackChannelId: {
          slackIntegrationId: integration.id,
          slackChannelId: event.channel,
        },
      },
    });
    if (!mapping) {
      return say(
        `Channel này chưa được gán collection tài liệu nên chưa hỏi được. ` +
          `Nhờ admin DocMind gán qua \`PUT /slack/channels/${event.channel}\`.`,
      );
    }

    const isFollowUp = Boolean(event.thread_ts) && event.thread_ts !== event.ts;
    const searchQuery = isFollowUp
      ? await this.resolveFollowUp(
          token,
          integration.tenantId,
          event.channel,
          event.thread_ts!,
          event.ts,
          authorizations?.[0]?.user_id,
          question,
        )
      : question;

    let result;
    try {
      result = await this.publicQuery.query(
        { tenantId: integration.tenantId, collectionId: mapping.collectionId },
        { query: searchQuery, topK: QUESTION_TOP_K },
      );
    } catch (err) {
      this.logger.error(`RAG failed for app_mention (team ${teamId})`, err);
      await this.api.postMessage(token, {
        channel: event.channel,
        thread_ts: threadTs,
        text: MSG_ANSWER_ERROR,
      });
      return;
    }

    const { text, blocks } = buildAnswerBlocks(result.answer, result.citations);
    if (searchQuery !== question) {
      // Cho người dùng thấy bot đã hiểu câu hỏi nối tiếp thế nào — sai thì họ biết cách diễn đạt lại.
      blocks.unshift({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Hiểu câu hỏi là: ${escapeSlackText(searchQuery)}_`,
          },
        ],
      });
    }
    const reply = await this.api.postMessage(token, {
      channel: event.channel,
      thread_ts: threadTs,
      text,
      blocks,
    });
    if (!reply.ok) {
      this.logger.error(
        `Posting answer failed: ${reply.error ?? 'unknown'} (team ${teamId})`,
      );
    }
  }

  /**
   * Đọc lịch sử thread và viết lại câu hỏi nối tiếp thành câu độc lập. Không bao giờ throw: mọi sự cố
   * (thiếu scope channels:history, Slack lỗi, LLM lỗi) đều trả về câu hỏi gốc.
   */
  private async resolveFollowUp(
    token: string,
    tenantId: string,
    channel: string,
    threadTs: string,
    currentTs: string,
    botUserId: string | undefined,
    question: string,
  ): Promise<string> {
    try {
      const replies = await this.api.getThreadReplies(token, channel, threadTs);
      if (!replies.ok || !replies.messages) {
        this.logger.warn(
          `conversations.replies failed (${replies.error ?? 'unknown'}) — answering without thread context. ` +
            `Nếu là missing_scope: thêm channels:history/groups:history rồi reinstall app.`,
        );
        return question;
      }
      const history = buildThreadHistory(replies.messages, {
        botUserId,
        currentTs,
      });
      return await this.condenser.condense(history, question, tenantId);
    } catch (err) {
      this.logger.warn(`Could not build thread context: ${String(err)}`);
      return question;
    }
  }

  private async ephemeral(
    token: string,
    channel: string,
    user: string,
    threadTs: string,
    text: string,
  ): Promise<void> {
    try {
      const res = await this.api.postEphemeral(token, {
        channel,
        user,
        text,
        thread_ts: threadTs,
      });
      if (!res.ok)
        this.logger.warn(
          `chat.postEphemeral failed: ${res.error ?? 'unknown'}`,
        );
    } catch (err) {
      this.logger.warn(`Could not send ephemeral message: ${String(err)}`);
    }
  }
}
