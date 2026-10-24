import { describe, expect, it, vi } from 'vitest';
import {
  buildSummaryPrompt,
  ConversationSummarizerService,
  planSummarization,
  SUMMARY_BATCH_MAX,
  SUMMARY_MAX_CHARS,
} from '../src/chat/conversation-summarizer.service.js';

describe('planSummarization', () => {
  it('returns null when total messages within history window (<= 10)', () => {
    expect(planSummarization(10, 0)).toBeNull();
    expect(planSummarization(4, 0)).toBeNull();
  });

  it('returns null when pending messages outside window are less than batch minimum (< 6)', () => {
    expect(planSummarization(15, 0)).toBeNull(); // 5 messages outside window
  });

  it('returns plan with skip and take when a batch is ready', () => {
    expect(planSummarization(16, 0)).toEqual({ skip: 0, take: 6 });
    expect(planSummarization(30, 6)).toEqual({ skip: 6, take: 14 });
  });

  it('returns null when all messages outside window are already summarized', () => {
    expect(planSummarization(16, 6)).toBeNull();
  });

  it('caps batch size at SUMMARY_BATCH_MAX when backlog is large', () => {
    expect(planSummarization(200, 0)).toEqual({
      skip: 0,
      take: SUMMARY_BATCH_MAX,
    });
  });
});

describe('buildSummaryPrompt', () => {
  it('includes previous summary and role-labeled transcript, or placeholder when none', () => {
    const p = buildSummaryPrompt('Previous summary', [
      { role: 'USER', content: 'What is ML?' },
      { role: 'ASSISTANT', content: 'It is machine learning.' },
    ]);
    expect(p).toContain('Previous summary');
    expect(p).toContain('Người dùng: What is ML?');
    expect(p).toContain('Trợ lý: It is machine learning.');
    expect(buildSummaryPrompt(null, [])).toContain('(chưa có)');
  });

  it('truncates long messages to prevent prompt bloat', () => {
    const p = buildSummaryPrompt(null, [
      { role: 'USER', content: 'x'.repeat(5000) },
    ]);
    expect(p.length).toBeLessThan(2000);
  });
});

function build(
  opts: {
    conv?: any;
    total?: number;
    messages?: any[];
    llmChunks?: string[];
    llmThrows?: boolean;
  } = {},
) {
  const conv =
    opts.conv === undefined ? { summary: null, summarizedCount: 0 } : opts.conv;
  const messages =
    opts.messages ??
    Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 ? 'ASSISTANT' : 'USER',
      content: `m${i}`,
    }));
  const tx = {
    conversation: {
      findUnique: vi.fn(async (..._a: any[]) => conv),
      updateMany: vi.fn(async (..._a: any[]) => ({ count: 1 })),
    },
    message: {
      count: vi.fn(async (..._a: any[]) => opts.total ?? 16),
      findMany: vi.fn(async (..._a: any[]) => messages),
    },
  };
  const prisma = {
    runInTenantContext: vi.fn(
      async (_t: string, fn: (tx: any) => Promise<any>) => fn(tx),
    ),
  };
  const llm = {
    streamChat: vi.fn(async function* (params: any) {
      if (opts.llmThrows) throw new Error('quota');
      for (const c of opts.llmChunks ?? ['Bản ', 'tóm tắt mới']) yield c;
      params.onUsage?.({ inputTokens: 100, outputTokens: 20 });
    }),
  };
  const usage = { record: vi.fn() };
  const svc = new ConversationSummarizerService(
    prisma as any,
    llm as any,
    usage as any,
  );
  return { svc, tx, llm, usage };
}

describe('ConversationSummarizerService.maybeSummarize', () => {
  it('calls LLM when batch ready, updates summary, increments summarizedCount, and records GENERATION usage', async () => {
    const { svc, tx, usage } = build({
      conv: { summary: 'cũ', summarizedCount: 0 },
    });

    await svc.maybeSummarize({ tenantId: 't1' }, 'c1');

    expect((tx.message.findMany.mock.calls[0]![0] as any).skip).toBe(0);
    expect((tx.message.findMany.mock.calls[0]![0] as any).take).toBe(6);
    expect(tx.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', summarizedCount: 0 },
      data: { summary: 'Bản tóm tắt mới', summarizedCount: 6 },
    });
    expect(usage.record).toHaveBeenCalledWith({
      tenantId: 't1',
      type: 'GENERATION',
      inputTokens: 100,
      outputTokens: 20,
    });
  });

  it('does not call LLM or update when batch is not ready', async () => {
    const { svc, tx, llm } = build({ total: 12 });
    await svc.maybeSummarize({ tenantId: 't1' }, 'c1');
    expect(llm.streamChat).not.toHaveBeenCalled();
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
  });

  it('ignores non-existent conversation', async () => {
    const { svc, llm } = build({ conv: null });
    await svc.maybeSummarize({ tenantId: 't1' }, 'c1');
    expect(llm.streamChat).not.toHaveBeenCalled();
  });

  it('does not throw or write when LLM fails', async () => {
    const { svc, tx } = build({ llmThrows: true });
    await expect(
      svc.maybeSummarize({ tenantId: 't1' }, 'c1'),
    ).resolves.toBeUndefined();
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
  });

  it('does not overwrite previous summary when LLM returns empty text', async () => {
    const { svc, tx } = build({ llmChunks: ['  \n'] });
    await svc.maybeSummarize({ tenantId: 't1' }, 'c1');
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
  });

  it('truncates summary to SUMMARY_MAX_CHARS when LLM output is too long', async () => {
    const { svc, tx } = build({ llmChunks: ['y'.repeat(5000)] });
    await svc.maybeSummarize({ tenantId: 't1' }, 'c1');
    const data = (tx.conversation.updateMany.mock.calls[0]![0] as any).data;
    expect(data.summary.length).toBe(SUMMARY_MAX_CHARS);
    expect(data.summary.endsWith('…')).toBe(true);
  });

  it('ignores concurrent summarization call for the same conversation', async () => {
    const { svc, llm } = build();
    await Promise.all([
      svc.maybeSummarize({ tenantId: 't1' }, 'c1'),
      svc.maybeSummarize({ tenantId: 't1' }, 'c1'),
    ]);
    expect(llm.streamChat).toHaveBeenCalledTimes(1);
  });
});
