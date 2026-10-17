import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  SLACK_MENTION_LIMIT_PER_MINUTE,
  SlackEventsService,
  extractQuestion,
} from '../src/slack/slack-events.service.js';
import { SlackCryptoService } from '../src/slack/slack-crypto.service.js';

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
      text: `<@${BOT}> What types of ML exist?`,
      channel: 'C0123ABCDEF',
      ts: '1700000000.000100',
      ...eventOver,
    },
    ...over,
  };
}

describe('extractQuestion', () => {
  it('removes bot mention at start, middle, or end of sentence', () => {
    expect(extractQuestion(`<@${BOT}> What is ML?`, BOT)).toBe('What is ML?');
    expect(extractQuestion(`Hey <@${BOT}> what is ML?`, BOT)).toBe(
      'Hey what is ML?',
    );
    expect(extractQuestion(`What is ML? <@${BOT}>`, BOT)).toBe('What is ML?');
  });

  it('preserves other mentions, only removes bot mention', () => {
    expect(extractQuestion(`<@${BOT}> what does <@U9> do?`, BOT)).toBe(
      'what does <@U9> do?',
    );
  });

  it('when bot id is unknown: only removes mention at the start', () => {
    expect(extractQuestion('<@U0BOT123> What is ML <@U9>?')).toBe(
      'What is ML <@U9>?',
    );
  });

  it('decodes &amp; &lt; &gt; without converting plain text to mention', () => {
    expect(extractQuestion(`<@${BOT}> A &amp; B &lt;@U9&gt;`, BOT)).toBe(
      'A & B <@U9>',
    );
  });

  it('preserves newlines, collapses extra whitespace', () => {
    expect(extractQuestion(`<@${BOT}>   line 1\nline   2`, BOT)).toBe(
      'line 1\nline 2',
    );
  });

  it('mention only -> returns empty string', () => {
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
        answer: 'There are **3 types** [1]',
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
    );
  });

  const lastEphemeral = () =>
    api.postEphemeral.mock.calls.at(-1)![1] as {
      text: string;
      user: string;
      thread_ts: string;
    };

  it('root mention: runs RAG in mapped collection, replies in thread of the mention message', async () => {
    await service.handle(payload());

    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'What types of ML exist?', topK: 5 },
    );
    expect(api.postMessage).toHaveBeenCalledTimes(1);
    const [token, msg] = api.postMessage.mock.calls[0]!;
    expect(token).toBe('xoxb-token');
    expect(msg.channel).toBe('C0123ABCDEF');
    expect(msg.thread_ts).toBe('1700000000.000100');
    expect(msg.blocks.length).toBeGreaterThan(0);
  });

  it('mention inside existing thread: replies into that thread (thread_ts), does not open new thread', async () => {
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    expect(api.postMessage.mock.calls[0]![1].thread_ts).toBe(
      '1699999999.000001',
    );
  });

  it('root mention (initial question): does not fetch thread replies or call condenser', async () => {
    await service.handle(payload());
    expect(api.getThreadReplies).not.toHaveBeenCalled();
    expect(condenser.condense).not.toHaveBeenCalled();
  });

  it('mention in thread: fetches thread history, condenses question, queries RAG with condensed question, adds context block', async () => {
    api.getThreadReplies.mockResolvedValue({
      ok: true,
      messages: [
        {
          ts: '1699999999.000001',
          user: 'U1',
          text: `<@${BOT}> What types of ML exist?`,
        },
        {
          ts: '1699999999.000002',
          user: BOT,
          bot_id: 'B1',
          text: 'x',
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: 'Supervised and Unsupervised.' },
            },
          ],
        },
        {
          ts: '1700000000.000100',
          user: 'U1',
          text: `<@${BOT}> and the second type?`,
        },
      ],
    });
    condenser.condense.mockResolvedValue('What is unsupervised learning?');

    await service.handle(
      payload({
        text: `<@${BOT}> and the second type?`,
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
        { role: 'user', content: 'What types of ML exist?' },
        { role: 'assistant', content: 'Supervised and Unsupervised.' },
      ],
      'and the second type?',
    );
    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'What is unsupervised learning?', topK: 5 },
    );
    const [, msg] = api.postMessage.mock.calls[0]!;
    expect(msg.thread_ts).toBe('1699999999.000001');
    expect(msg.blocks[0].type).toBe('context');
    expect(msg.blocks[0].elements[0].text).toContain(
      'What is unsupervised learning?',
    );
  });

  it('condensed question identical to original question -> does not insert context block', async () => {
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    const [, msg] = api.postMessage.mock.calls[0]!;
    expect(msg.blocks[0].type).toBe('section');
  });

  it('failed to fetch thread replies (missing scope) -> answers using original question', async () => {
    api.getThreadReplies.mockResolvedValue({
      ok: false,
      error: 'missing_scope',
    });
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    expect(condenser.condense).not.toHaveBeenCalled();
    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'What types of ML exist?', topK: 5 },
    );
    expect(api.postMessage).toHaveBeenCalledTimes(1);
  });

  it('fetching thread throws network error -> answers using original question', async () => {
    api.getThreadReplies.mockRejectedValue(new Error('network'));
    await service.handle(payload({ thread_ts: '1699999999.000001' }));
    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'What types of ML exist?', topK: 5 },
    );
  });

  it('same event_id sent again (retry/duplicate) -> processed only once', async () => {
    const p = payload();
    await service.handle(p);
    await service.handle(p);
    expect(publicQuery.query).toHaveBeenCalledTimes(1);
    expect(api.postMessage).toHaveBeenCalledTimes(1);
  });

  it('bot message (bot_id) -> ignored to avoid reply loop', async () => {
    await service.handle(payload({ bot_id: 'B1' }));
    expect(system.slackIntegration.findUnique).not.toHaveBeenCalled();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('non app_mention event or invalid payload -> silently ignored', async () => {
    await service.handle(payload({ type: 'message' }));
    await service.handle({ type: 'event_callback' });
    await service.handle(null);
    await service.handle('invalid');
    expect(system.slackIntegration.findUnique).not.toHaveBeenCalled();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('workspace not connected -> does nothing (no token to reply)', async () => {
    system.slackIntegration.findUnique.mockResolvedValue(null);
    await service.handle(payload());
    expect(api.postMessage).not.toHaveBeenCalled();
    expect(api.postEphemeral).not.toHaveBeenCalled();
  });

  it('mention only without question -> ephemeral usage guidance to correct user and thread', async () => {
    await service.handle(payload({ text: `<@${BOT}>` }));
    expect(lastEphemeral().text).toContain('@DocMind');
    expect(lastEphemeral().user).toBe('U1');
    expect(lastEphemeral().thread_ts).toBe('1700000000.000100');
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('question too long -> ephemeral, does not call RAG', async () => {
    await service.handle(payload({ text: `<@${BOT}> ${'x'.repeat(2001)}` }));
    expect(lastEphemeral().text).toContain('quá dài');
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('channel not mapped to collection -> ephemeral with channel id, does not call RAG', async () => {
    system.slackChannelMapping.findUnique.mockResolvedValue(null);
    await service.handle(payload());
    expect(lastEphemeral().text).toContain('PUT /slack/channels/C0123ABCDEF');
    expect(publicQuery.query).not.toHaveBeenCalled();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('RAG failure -> polite error in thread without leaking details', async () => {
    publicQuery.query.mockRejectedValue(
      new Error('Gemini quota exceeded: secret detail'),
    );
    await service.handle(payload());
    const [, msg] = api.postMessage.mock.calls[0]!;
    expect(msg.thread_ts).toBe('1700000000.000100');
    expect(msg.text).toContain('gặp lỗi');
    expect(msg.text).not.toContain('secret detail');
  });

  it('workspace rate limit exceeded -> ephemeral with retry-after seconds', async () => {
    for (let i = 0; i < SLACK_MENTION_LIMIT_PER_MINUTE; i++)
      await service.handle(payload());
    publicQuery.query.mockClear();

    await service.handle(payload());
    expect(lastEphemeral().text).toMatch(/Thử lại sau khoảng \d+ giây/);
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('handle() never throws', async () => {
    system.slackIntegration.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.handle(payload())).resolves.toBeUndefined();
  });

  it('ephemeral failure does not cause handle() to throw', async () => {
    api.postEphemeral.mockRejectedValue(new Error('network'));
    await expect(
      service.handle(payload({ text: `<@${BOT}>` })),
    ).resolves.toBeUndefined();
  });
});
