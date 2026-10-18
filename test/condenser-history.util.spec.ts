import { describe, expect, it } from 'vitest';
import { buildCondenserHistory } from '../src/chat/condenser-history.util.js';

describe('buildCondenserHistory', () => {
  it('converts USER/ASSISTANT roles to user/assistant and preserves order', () => {
    expect(
      buildCondenserHistory([
        { role: 'USER', content: 'a' },
        { role: 'ASSISTANT', content: 'b' },
      ]),
    ).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ]);
  });

  it('keeps only the N most recent messages', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: 'USER' as const,
      content: `m${i}`,
    }));
    const out = buildCondenserHistory(msgs, 3);
    expect(out.map((m) => m.content)).toEqual(['m7', 'm8', 'm9']);
  });

  it('truncates messages exceeding max characters', () => {
    const out = buildCondenserHistory(
      [{ role: 'ASSISTANT', content: 'x'.repeat(5000) }],
      6,
      100,
    );
    expect(out[0]!.content).toHaveLength(100);
  });

  it('returns empty array when history is empty', () => {
    expect(buildCondenserHistory([])).toEqual([]);
  });
});
