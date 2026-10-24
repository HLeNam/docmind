import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  SLACK_MENTION_LIMIT_PER_MINUTE,
  SlackEventsService,
  extractQuestion,
} from '../src/slack/slack-events.service.js';
import { SlackCryptoService } from '../src/slack/slack-crypto.service.js';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';

const cryptoKey = randomBytes(32).toString('base64');
const BOT = 'U0BOT123';

let seq = 0;
function payload(
  eventOver: Record<string, unknown> = {},
  over: Record<string, unknown> = {},
) {
  seq += 1;
  return {
    type: 'event_callback',
    team_id: 'T1',
    event_id: `Ev${seq}`,
    authorizations: [{ user_id: BOT }],
    event: {
      type: 'app_mention',
      user: 'U1',
      text: `<@${BOT}> Có những loại ML nào?`,
      channel: 'C0123ABCDEF',
      ts: '1700000000.000100',
      ...eventOver,
    },
    ...over,
  };
}

describe('extractQuestion', () => {
  it('strips bot mention at beginning, middle, or end of text', () => {
    expect(extractQuestion(`<@${BOT}> ML là gì?`, BOT)).toBe('ML là gì?');
    expect(extractQuestion(`Này <@${BOT}> ML là gì?`, BOT)).toBe(
      'Này ML là gì?',
    );
    expect(extractQuestion(`ML là gì? <@${BOT}>`, BOT)).toBe('ML là gì?');
  });

  it('preserves other user mentions and only strips bot mention', () => {
    expect(extractQuestion(`<@${BOT}> <@U9> làm gì?`, BOT)).toBe(
      '<@U9> làm gì?',
    );
  });

  it('strips leading mention when bot id is unknown', () => {
    expect(extractQuestion('<@U0BOT123> ML là gì <@U9>?')).toBe(
      'ML là gì <@U9>?',
    );
  });

  it('decodes HTML entities (&amp;, &lt;, &gt;) without altering normal mentions', () => {
    expect(extractQuestion(`<@${BOT}> A &amp; B &lt;@U9&gt;`, BOT)).toBe(
      'A & B <@U9>',
    );
  });

  it('preserves newlines and collapses redundant spaces', () => {
    expect(extractQuestion(`<@${BOT}>   dòng 1\ndòng   2`, BOT)).toBe(
      'dòng 1\ndòng 2',
    );
  });

  it('returns empty string when text contains only bot mention', () => {
    expect(extractQuestion(`<@${BOT}>`, BOT)).toBe('');
  });
});

describe('SlackEventsService', () => {
  let system: any;
  let api: {
    postMessage: Mock<(...a: any[]) => Promise<any>>;
    postEphemeral: Mock<(...a: any[]) => Promise<any>>;
    getThreadReplies: Mock<(...a: any[]) => Promise<any>>;
  };
  let condenser: { condense: Mock<(...a: any[]) => Promise<string>> };
  let publicQuery: { query: Mock<(...a: any[]) => Promise<any>> };
  let service: SlackEventsService;

  beforeEach(() => {
    const crypto = new SlackCryptoService({ get: () => cryptoKey } as any);
    system = {
      slackIntegration: {
        findUnique: vi.fn(async () => ({
          id: 'si1',
          tenantId: 't1',
          accessToken: crypto.encrypt('xoxb-token'),
        })),
      },
      slackChannelMapping: {
        findUnique: vi.fn(async () => ({ id: 'm1', collectionId: 'c1' })),
      },
    };
    api = {
      postMessage: vi.fn(async () => ({ ok: true, ts: '1700000001.000200' })),
      postEphemeral: vi.fn(async () => ({ ok: true })),
      getThreadReplies: vi.fn(async () => ({ ok: true, messages: [] })),
    };
    condenser = { condense: vi.fn(async (_h: unknown, q: string) => q) };
    publicQuery = {
      query: vi.fn(async () => ({
        answer: 'Có **3 loại** [1]',
        citations: [
          { index: 1, filename: 'a.pdf', pageNumber: 7, headingContext: null },
        ],
      })),
    };
    service = new SlackEventsService(
      system,
      crypto,
      api as any,
      publicQuery as any,
      condenser as any,
      new RateLimitService(null),
    );
  });

  const lastEphemeral = () =>
    api.postEphemeral.mock.calls.at(-1)![1] as {
      text: string;
      user: string;
      thread_ts: string;
    };

  it('performs RAG for mapped tenant and collection and replies in mention thread for top-level mention', async () => {
    await service.handle(payload());

    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'Có những loại ML nào?', topK: 5 },
    );
    expect(api.postMessage).toHaveBeenCalledTimes(1);
    const [token, msg] = api.postMessage.mock.calls[0]!;
    expect(token).toBe('xoxb-token');
    expect(msg.channel).toBe('C0123ABCDEF');
    expect(msg.thread_ts).toBe('1700000000.000100');
    expect(msg.blocks.length).toBeGreaterThan(0);
  });

  it('replies in existing thread (thread_ts) without opening a new thread for thread mentions', async () => {
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    expect(api.postMessage.mock.calls[0]![1].thread_ts).toBe(
      '1699999999.000001',
    );
  });

  it('does not fetch thread replies or call condenser for top-level mention', async () => {
    await service.handle(payload());
    expect(api.getThreadReplies).not.toHaveBeenCalled();
    expect(condenser.condense).not.toHaveBeenCalled();
  });

  it('fetches history, rewrites question, searches with rewritten query, and displays query context for thread mention', async () => {
    api.getThreadReplies.mockResolvedValue({
      ok: true,
      messages: [
        {
          ts: '1699999999.000001',
          user: 'U1',
          text: `<@${BOT}> Có những loại ML nào?`,
        },
        {
          ts: '1699999999.000002',
          user: BOT,
          bot_id: 'B1',
          text: 'x',
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: 'Có Supervised và Unsupervised.' },
            },
          ],
        },
        {
          ts: '1700000000.000100',
          user: 'U1',
          text: `<@${BOT}> còn loại thứ hai?`,
        },
      ],
    });
    condenser.condense.mockResolvedValue('Unsupervised learning là gì?');

    await service.handle(
      payload({
        text: `<@${BOT}> còn loại thứ hai?`,
        thread_ts: '1699999999.000001',
      }),
    );

    expect(api.getThreadReplies).toHaveBeenCalledWith(
      'xoxb-token',
      'C0123ABCDEF',
      '1699999999.000001',
    );
    expect(condenser.condense).toHaveBeenCalledWith(
      [
        { role: 'user', content: 'Có những loại ML nào?' },
        { role: 'assistant', content: 'Có Supervised và Unsupervised.' },
      ],
      'còn loại thứ hai?',
      't1',
    );
    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'Unsupervised learning là gì?', topK: 5 },
    );
    const [, msg] = api.postMessage.mock.calls[0]!;
    expect(msg.thread_ts).toBe('1699999999.000001');
    expect(msg.blocks[0].type).toBe('context');
    expect(msg.blocks[0].elements[0].text).toContain(
      'Unsupervised learning là gì?',
    );
  });

  it('does not insert query context block when rewritten query matches original', async () => {
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    const [, msg] = api.postMessage.mock.calls[0]!;
    expect(msg.blocks[0].type).toBe('section');
  });

  it('falls back to original question when fetching thread replies fails with missing scope', async () => {
    api.getThreadReplies.mockResolvedValue({
      ok: false,
      error: 'missing_scope',
    });
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    expect(condenser.condense).not.toHaveBeenCalled();
    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'Có những loại ML nào?', topK: 5 },
    );
    expect(api.postMessage).toHaveBeenCalledTimes(1);
  });

  it('falls back to original question when fetching thread replies encounters network error', async () => {
    api.getThreadReplies.mockRejectedValue(new Error('network'));
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'Có những loại ML nào?', topK: 5 },
    );
  });

  it('processes identical event_id only once to prevent duplicate handling', async () => {
    const p = payload();
    await service.handle(p);
    await service.handle(p);
    expect(publicQuery.query).toHaveBeenCalledTimes(1);
    expect(api.postMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores bot messages (bot_id) to prevent infinite reply loops', async () => {
    await service.handle(payload({ bot_id: 'B1' }));
    expect(system.slackIntegration.findUnique).not.toHaveBeenCalled();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('silently ignores events that are not app_mention or invalid payloads', async () => {
    await service.handle(payload({ type: 'message' }));
    await service.handle({ type: 'event_callback' });
    await service.handle(null);
    await service.handle('rác');
    expect(system.slackIntegration.findUnique).not.toHaveBeenCalled();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('does nothing when workspace is not connected', async () => {
    system.slackIntegration.findUnique.mockResolvedValue(null);
    await service.handle(payload());
    expect(api.postMessage).not.toHaveBeenCalled();
    expect(api.postEphemeral).not.toHaveBeenCalled();
  });

  it('sends ephemeral guidance to user in thread when mention has no question', async () => {
    await service.handle(payload({ text: `<@${BOT}>` }));
    expect(lastEphemeral().text).toContain('@DocMind');
    expect(lastEphemeral().user).toBe('U1');
    expect(lastEphemeral().thread_ts).toBe('1700000000.000100');
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('sends ephemeral error without running RAG when question is too long', async () => {
    await service.handle(payload({ text: `<@${BOT}> ${'x'.repeat(2001)}` }));
    expect(lastEphemeral().text).toContain('quá dài');
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('sends ephemeral error with channel ID without running RAG when channel is unmapped', async () => {
    system.slackChannelMapping.findUnique.mockResolvedValue(null);
    await service.handle(payload());
    expect(lastEphemeral().text).toContain('PUT /slack/channels/C0123ABCDEF');
    expect(publicQuery.query).not.toHaveBeenCalled();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('posts polite error message in thread without leaking internal details when RAG fails', async () => {
    publicQuery.query.mockRejectedValue(
      new Error('Gemini quota exceeded: secret detail'),
    );
    await service.handle(payload());
    const [, msg] = api.postMessage.mock.calls[0]!;
    expect(msg.thread_ts).toBe('1700000000.000100');
    expect(msg.text).toContain('gặp lỗi');
    expect(msg.text).not.toContain('secret detail');
  });

  it('sends ephemeral rate limit warning with retry delay when workspace rate limit is exceeded', async () => {
    for (let i = 0; i < SLACK_MENTION_LIMIT_PER_MINUTE; i++)
      await service.handle(payload());
    publicQuery.query.mockClear();

    await service.handle(payload());
    expect(lastEphemeral().text).toMatch(/Thử lại sau khoảng \d+ giây/);
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('never throws an error from handle()', async () => {
    system.slackIntegration.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.handle(payload())).resolves.toBeUndefined();
  });

  it('does not throw when sending ephemeral message fails', async () => {
    api.postEphemeral.mockRejectedValue(new Error('network'));
    await expect(
      service.handle(payload({ text: `<@${BOT}>` })),
    ).resolves.toBeUndefined();
  });
});
