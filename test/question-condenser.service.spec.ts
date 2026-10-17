import { describe, expect, it, vi, type Mock } from 'vitest';
import { QuestionCondenserService } from '../src/public-api/question-condenser.service.js';

function llmReturning(chunks: string[]) {
  return {
    streamChat: vi.fn(async function* () {
      for (const c of chunks) yield c;
    }),
  };
}

const HISTORY = [
  { role: 'user' as const, content: 'Có những loại ML nào?' },
  { role: 'assistant' as const, content: 'Có Supervised và Unsupervised.' },
];

describe('QuestionCondenserService', () => {
  it('empty history -> returns original question and does not call LLM', async () => {
    const llm = llmReturning(['x']);
    const out = await new QuestionCondenserService(llm as any).condense(
      [],
      'ML là gì?',
    );
    expect(out).toBe('ML là gì?');
    expect(llm.streamChat).not.toHaveBeenCalled();
  });

  it('with history -> sends transcript and new question, returns condensed question (joins chunks, trims quotes)', async () => {
    const llm = llmReturning(['"Unsuper', 'vised learning là gì?"\n']);
    const out = await new QuestionCondenserService(llm as any).condense(
      HISTORY,
      'còn loại thứ hai?',
    );

    expect(out).toBe('Unsupervised learning là gì?');
    const params = (llm.streamChat as Mock).mock.calls[0]![0] as any;
    expect(params.systemPrompt).toContain('độc lập');
    const prompt = params.messages[0].content as string;
    expect(prompt).toContain('Người dùng: Có những loại ML nào?');
    expect(prompt).toContain('Trợ lý: Có Supervised và Unsupervised.');
    expect(prompt).toContain('Câu hỏi mới: còn loại thứ hai?');
  });

  it('LLM returns empty -> falls back to original question', async () => {
    const out = await new QuestionCondenserService(
      llmReturning(['  \n']) as any,
    ).condense(HISTORY, 'còn loại hai?');
    expect(out).toBe('còn loại hai?');
  });

  it('LLM output exceeds length limit -> falls back to original question', async () => {
    const out = await new QuestionCondenserService(
      llmReturning(['x'.repeat(1500)]) as any,
    ).condense(HISTORY, 'còn loại hai?');
    expect(out).toBe('còn loại hai?');
  });

  it('LLM error -> does not throw, falls back to original question', async () => {
    const llm = {
      streamChat: vi.fn(async function* () {
        if (true as boolean) throw new Error('quota');
        yield '';
      }),
    };
    const out = await new QuestionCondenserService(llm as any).condense(
      HISTORY,
      'còn loại hai?',
    );
    expect(out).toBe('còn loại hai?');
  });
});
