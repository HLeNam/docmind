// Xử lý sự kiện Slack Events API — hiện chỉ `app_mention` (người dùng gõ `@DocMind <câu hỏi>`).
//
// Khác /ask: người dùng tự viết câu hỏi trong channel/thread nên KHÔNG đăng lại câu hỏi; bot trả lời ngay
// trong thread của tin nhắn đó (thread_ts = thread hiện có, hoặc chính tin nhắn mention nếu là tin gốc).
// Lỗi/hướng dẫn gửi dạng ephemeral (chat.postEphemeral) vì sự kiện không có response_url.
//
// 4.6a: mỗi mention là một câu hỏi độc lập (chưa nhớ lượt trước) — nhớ thread làm ở 4.6b.
// Quyền truy cập dữ liệu: giống /ask — chỉ do mapping channel -> collection quyết định.
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { PublicQueryService } from '../public-api/public-query.service.js';
import { SlackApiClient } from './slack-api.client.js';
import { SlackCryptoService } from './slack-crypto.service.js';
import { EventDeduper } from './slack-event-dedupe.js';
import { FixedWindowRateLimiter } from './slack-rate-limiter.js';
import { buildAnswerBlocks } from './slack-mrkdwn.util.js';

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

export const SLACK_MENTION_LIMIT_PER_MINUTE = 15;
const MAX_QUESTION_CHARS = 2000;
const QUESTION_TOP_K = 5;

const MSG_USAGE =
  'Hãy gõ câu hỏi sau tên bot, ví dụ: `@DocMind Quy trình xin nghỉ phép là gì?`';
const MSG_TOO_LONG = `Câu hỏi quá dài (tối đa ${MAX_QUESTION_CHARS} ký tự).`;
const MSG_ANSWER_ERROR =
  'Xin lỗi, DocMind gặp lỗi khi tìm câu trả lời. Vui lòng thử lại sau.';

/**
 * Lấy câu hỏi từ text của sự kiện: bỏ mention bot, giải mã ký tự Slack đã escape (&amp; &lt; &gt;).
 * Không có botUserId thì chỉ bỏ các mention nằm ở ĐẦU câu.
 */
export function extractQuestion(rawText: string, botUserId?: string): string {
  let text = rawText;
  if (botUserId && /^[A-Z0-9]+$/.test(botUserId)) {
    text = text.replace(new RegExp(`<@${botUserId}(\\|[^>]*)?>`, 'g'), ' ');
  } else {
    text = text.replace(/^(\s*<@[A-Z0-9]+(\|[^>]*)?>)+/, ' ');
  }
  // Giải mã SAU khi bỏ mention: "&lt;@U1&gt;" người dùng gõ chữ thường chỉ là văn bản, không phải mention.
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return text.replace(/[ \t]+/g, ' ').trim();
}

@Injectable()
export class SlackEventsService {
  private readonly logger = new Logger(SlackEventsService.name);
  private readonly limiter = new FixedWindowRateLimiter(
    SLACK_MENTION_LIMIT_PER_MINUTE,
    60_000,
  );
  private readonly deduper = new EventDeduper();

  constructor(
    private readonly system: PrismaSystemService,
    private readonly crypto: SlackCryptoService,
    private readonly api: SlackApiClient,
    private readonly publicQuery: PublicQueryService,
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

    if (!this.deduper.firstSeen(eventId)) return;

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

    const limit = this.limiter.check(`team:${teamId}`);
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

    let result;
    try {
      result = await this.publicQuery.query(
        { tenantId: integration.tenantId, collectionId: mapping.collectionId },
        { query: question, topK: QUESTION_TOP_K },
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
