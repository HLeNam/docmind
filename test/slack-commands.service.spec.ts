import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  SLACK_ASK_LIMIT_PER_MINUTE,
  SlackCommandsService,
  type SlackCommandPayload,
} from '../src/slack/slack-commands.service.js';
import { SlackCryptoService } from '../src/slack/slack-crypto.service.js';

const cryptoKey = randomBytes(32).toString('base64');

function cmd(over: Partial<SlackCommandPayload> = {}): SlackCommandPayload {
  return {
    team_id: 'T1',
    channel_id: 'C0123ABCDEF',
    user_id: 'U1',
    text: 'What types of machine learning exist?',
    response_url: 'https://hooks.slack.com/commands/T1/xxx',
    ...over,
  };
}

describe('SlackCommandsService', () => {
  let system: any;
  let api: {
    postMessage: Mock<(...a: any[]) => Promise<any>>;
    respondEphemeral: Mock<(...a: any[]) => Promise<void>>;
  };
  let publicQuery: { query: Mock<(...a: any[]) => Promise<any>> };
  let crypto: SlackCryptoService;
  let service: SlackCommandsService;

  beforeEach(() => {
    crypto = new SlackCryptoService({ get: () => cryptoKey } as any);
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
      postMessage: vi.fn(async () => ({ ok: true, ts: '1700000000.000100' })),
      respondEphemeral: vi.fn(async () => undefined),
    };
    publicQuery = {
      query: vi.fn(async () => ({
        answer: 'There are **3 types** [1]',
        citations: [
          { index: 1, filename: 'a.pdf', pageNumber: 7, headingContext: null },
        ],
      })),
    };
    service = new SlackCommandsService(
      system,
      crypto,
      api as any,
      publicQuery as any,
    );
  });

  const lastEphemeral = () =>
    api.respondEphemeral.mock.calls.at(-1)![1] as string;

  it('happy path: posts question -> runs RAG in mapped collection -> replies in thread with blocks', async () => {
    await service.handle(cmd());

    expect(api.postMessage).toHaveBeenCalledTimes(2);
    const [token1, question] = api.postMessage.mock.calls[0]!;
    expect(token1).toBe('xoxb-token');
    expect(question.channel).toBe('C0123ABCDEF');
    expect(question.thread_ts).toBeUndefined();
    expect(question.text).toContain('<@U1>');
    expect(question.text).toContain('> What types of machine learning exist?');

    expect(publicQuery.query).toHaveBeenCalledWith(
      { tenantId: 't1', collectionId: 'c1' },
      { query: 'What types of machine learning exist?', topK: 5 },
    );

    const [, reply] = api.postMessage.mock.calls[1]!;
    expect(reply.thread_ts).toBe('1700000000.000100');
    expect(reply.blocks.length).toBeGreaterThan(0);
    expect(reply.text).toContain('*3 types*');
    expect(api.respondEphemeral).not.toHaveBeenCalled();
  });

  it('multiline question: quotes every line with ">" and escapes special characters', async () => {
    await service.handle(cmd({ text: 'line 1 <@U9>\nline 2' }));
    const question = api.postMessage.mock.calls[0]![1].text as string;
    expect(question).toContain('> line 1 &lt;@U9&gt;\n> line 2');
  });

  it('empty text -> shows usage guidance ephemeral without querying DB', async () => {
    await service.handle(cmd({ text: '   ' }));
    expect(lastEphemeral()).toContain('/ask');
    expect(system.slackIntegration.findUnique).not.toHaveBeenCalled();
  });

  it('question too long -> responds ephemeral, does not call RAG', async () => {
    await service.handle(cmd({ text: 'x'.repeat(2001) }));
    expect(lastEphemeral()).toContain('2000');
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('workspace not connected -> responds ephemeral, does not post to channel', async () => {
    system.slackIntegration.findUnique.mockResolvedValue(null);
    await service.handle(cmd());
    expect(lastEphemeral()).toBeTruthy();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('unmapped channel -> rejects with channel ID for admin configuration, does not call RAG', async () => {
    system.slackChannelMapping.findUnique.mockResolvedValue(null);
    await service.handle(cmd());
    expect(lastEphemeral()).toContain('PUT /slack/channels/C0123ABCDEF');
    expect(publicQuery.query).not.toHaveBeenCalled();
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it.each(['not_in_channel', 'channel_not_found'])(
    'bot cannot access channel (%s) -> guides user to /invite',
    async (error) => {
      api.postMessage.mockResolvedValue({ ok: false, error });
      await service.handle(cmd());
      expect(lastEphemeral()).toContain('/invite');
      expect(publicQuery.query).not.toHaveBeenCalled();
    },
  );

  it('other Slack error when posting question -> generic message without exposing internal errors', async () => {
    api.postMessage.mockResolvedValue({ ok: false, error: 'ratelimited' });
    await service.handle(cmd());
    expect(lastEphemeral()).toBeTruthy();
    expect(lastEphemeral()).not.toContain('ratelimited');
  });

  it('RAG failure -> replies politely in thread without leaking error details', async () => {
    publicQuery.query.mockRejectedValue(
      new Error('Gemini quota exceeded: secret detail'),
    );
    await service.handle(cmd());

    const [, reply] = api.postMessage.mock.calls[1]!;
    expect(reply.thread_ts).toBe('1700000000.000100');
    expect(reply.text).not.toContain('secret detail');
  });

  it('workspace rate limit exceeded -> responds ephemeral with retry-after, does not call RAG', async () => {
    for (let i = 0; i < SLACK_ASK_LIMIT_PER_MINUTE; i++)
      await service.handle(cmd());
    publicQuery.query.mockClear();

    await service.handle(cmd());

    expect(lastEphemeral()).toMatch(/\d+/);
    expect(publicQuery.query).not.toHaveBeenCalled();
  });

  it('rate limiting is workspace-scoped: other workspaces are not affected', async () => {
    for (let i = 0; i < SLACK_ASK_LIMIT_PER_MINUTE + 1; i++)
      await service.handle(cmd());
    publicQuery.query.mockClear();

    await service.handle(cmd({ team_id: 'T2' }));
    expect(publicQuery.query).toHaveBeenCalledTimes(1);
  });

  it('handle() never throws: unexpected error -> logs and attempts generic ephemeral reply', async () => {
    system.slackIntegration.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.handle(cmd())).resolves.toBeUndefined();
    expect(lastEphemeral()).toBeTruthy();
  });

  it('handle() does not throw even if ephemeral error notification fails', async () => {
    system.slackIntegration.findUnique.mockRejectedValue(new Error('db down'));
    api.respondEphemeral.mockRejectedValue(new Error('response_url expired'));
    await expect(service.handle(cmd())).resolves.toBeUndefined();
  });
});
