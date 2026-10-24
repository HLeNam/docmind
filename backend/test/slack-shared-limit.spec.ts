import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
import { SlackCommandsService } from '../src/slack/slack-commands.service.js';
import { SlackEventsService } from '../src/slack/slack-events.service.js';
import { SlackCryptoService } from '../src/slack/slack-crypto.service.js';
import { SLACK_TEAM_LIMIT_PER_MINUTE } from '../src/slack/slack-limits.js';

describe('Slack: shared rate limit between /ask and @DocMind', () => {
  it('exhausting rate limit via /ask blocks @DocMind mention in the same workspace', async () => {
    const cryptoKey = randomBytes(32).toString('base64');
    const crypto = new SlackCryptoService({
      get: () => cryptoKey,
    } as any);
    const system: any = {
      slackIntegration: {
        findUnique: vi.fn(async () => ({
          id: 'si1',
          tenantId: 't1',
          accessToken: crypto.encrypt('xoxb'),
        })),
      },
      slackChannelMapping: {
        findUnique: vi.fn(async () => ({ id: 'm1', collectionId: 'c1' })),
      },
    };
    const api: any = {
      postMessage: vi.fn(async () => ({ ok: true, ts: '1.1' })),
      respondEphemeral: vi.fn(async () => undefined),
      postEphemeral: vi.fn(async () => ({ ok: true })),
      getThreadReplies: vi.fn(async () => ({ ok: true, messages: [] })),
    };
    const publicQuery: any = {
      query: vi.fn(async () => ({ answer: 'ok', citations: [] })),
    };
    const condenser: any = {
      condense: vi.fn(async (_h: unknown, q: string) => q),
    };
    const shared = new RateLimitService(null);

    const commands = new SlackCommandsService(
      system,
      crypto,
      api,
      publicQuery,
      shared,
    );
    const events = new SlackEventsService(
      system,
      crypto,
      api,
      publicQuery,
      condenser,
      shared,
    );

    for (let i = 0; i < SLACK_TEAM_LIMIT_PER_MINUTE; i++) {
      await commands.handle({
        team_id: 'T1',
        channel_id: 'C0123ABCDEF',
        user_id: 'U1',
        text: 'question',
        response_url: 'https://hooks.slack.com/x',
      });
    }
    publicQuery.query.mockClear();

    await events.handle({
      type: 'event_callback',
      team_id: 'T1',
      event_id: 'EvShared1',
      authorizations: [{ user_id: 'U0BOT' }],
      event: {
        type: 'app_mention',
        user: 'U1',
        text: '<@U0BOT> ask something',
        channel: 'C0123ABCDEF',
        ts: '1700000000.000100',
      },
    });

    expect(publicQuery.query).not.toHaveBeenCalled();
    expect(api.postEphemeral).toHaveBeenCalled();
    expect((api.postEphemeral.mock.calls.at(-1) as any[])[1].text).toMatch(
      /Thử lại sau khoảng \d+ giây/,
    );
  });
});
