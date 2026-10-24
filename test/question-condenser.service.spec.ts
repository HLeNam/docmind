import { describe, expect, it, vi } from 'vitest';
import { QuestionCondenserService } from '../src/public-api/question-condenser.service.js';

function llmReturning(chunks: string[]) {
  return {
    streamChat: vi.fn(async function* () {
      for (const c of chunks) yield c;
    }),
  };
}

const usage = { record: vi.fn() };

const HISTORY = [
  { role: 'user' as const, content: 'Có những loại ML nào?' },
  { role: 'assistant' as const, content: 'Có Supervised và Unsupervised.' },
];

describe('QuestionCondenserService', () => {
  it('returns original question without calling LLM when history is empty', async () => {
    const llm = llmReturning(['x']);
    const out = await new QuestionCondenserService(
      llm as any,
      usage as any,
    ).condense([], 'ML là gì?', 't1');
    expect(out).toBe('ML là gì?');
    expect(llm.streamChat).not.toHaveBeenCalled();
  });

  it('sends transcript and new question, returning rewritten question without quotes when history is present', async () => {
    const llm = llmReturning(['"Unsuper', 'vised learning là gì?"\n']);
    const out = await new QuestionCondenserService(
      llm as any,
      usage as any,
    ).condense(HISTORY, 'còn loại thứ hai?', 't1');

    expect(out).toBe('Unsupervised learning là gì?');
    const params = (llm.streamChat as any).mock.calls[0]![0] as any;
    expect(params.systemPrompt).toContain('độc lập');
    const prompt = params.messages[0].content as string;
    expect(prompt).toContain('Người dùng: Có những loại ML nào?');
    expect(prompt).toContain('Trợ lý: Có Supervised và Unsupervised.');
    expect(prompt).toContain('Câu hỏi mới: còn loại thứ hai?');
  });

  it('system prompt instructs preserving user keywords without adding assumptions', async () => {
    const llm = llmReturning(['ok']);
    await new QuestionCondenserService(llm as any, usage as any).condense(
      HISTORY,
      'còn loại hai?',
      't1',
    );
    const { systemPrompt } = (llm.streamChat as any).mock.calls[0]![0] as any;
    expect(systemPrompt).toContain('GIỮ NGUYÊN mọi từ khoá');
    expect(systemPrompt).toContain('KHÔNG thêm thông tin');
    expect(systemPrompt).toContain('khoa chính trị - hành chính');
  });

  it('falls back to original question when LLM returns empty', async () => {
    const out = await new QuestionCondenserService(
      llmReturning(['  \n']) as any,
      usage as any,
    ).condense(HISTORY, 'còn loại hai?', 't1');
    expect(out).toBe('còn loại hai?');
  });

  it('falls back to original question when LLM output is excessively long', async () => {
    const out = await new QuestionCondenserService(
      llmReturning(['x'.repeat(1500)]) as any,
      usage as any,
    ).condense(HISTORY, 'còn loại hai?', 't1');
    expect(out).toBe('còn loại hai?');
  });

  it('falls back to original question without throwing when LLM fails', async () => {
    const llm = {
      streamChat: vi.fn(() => ({
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<IteratorResult<string>> {
              throw new Error('quota');
            },
          };
        },
      })),
    };
    const out = await new QuestionCondenserService(
      llm as any,
      usage as any,
    ).condense(HISTORY, 'còn loại hai?', 't1');
    expect(out).toBe('còn loại hai?');
  });

  it('records GENERATION UsageLog for tenant when token usage is reported', async () => {
    const record = vi.fn();
    const llm = {
      streamChat: vi.fn(async function* (params: any) {
        yield 'Unsupervised là gì?';
        params.onUsage({ inputTokens: 90, outputTokens: 8 });
      }),
    };
    await new QuestionCondenserService(llm as any, { record } as any).condense(
      HISTORY,
      'còn loại hai?',
      'tenant-9',
    );
    expect(record).toHaveBeenCalledWith({
      tenantId: 'tenant-9',
      type: 'GENERATION',
      inputTokens: 90,
      outputTokens: 8,
    });
  });
});
