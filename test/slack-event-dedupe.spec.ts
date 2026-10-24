import { describe, expect, it } from 'vitest';
import { EventDeduper } from '../src/slack/slack-event-dedupe.js';

describe('EventDeduper', () => {
  it('first time seeing id -> true, subsequent calls -> false', () => {
    const d = new EventDeduper();
    expect(d.firstSeen('Ev1')).toBe(true);
    expect(d.firstSeen('Ev1')).toBe(false);
    expect(d.firstSeen('Ev2')).toBe(true);
  });

  it('once expired, treated as not seen yet', () => {
    let now = 0;
    const d = new EventDeduper(1000, () => now);
    d.firstSeen('Ev1');
    now = 999;
    expect(d.firstSeen('Ev1')).toBe(false);
    now = 1001;
    expect(d.firstSeen('Ev1')).toBe(true);
  });

  it('does not grow unbounded: prunes oldest entries when exceeding maxEntries', () => {
    const d = new EventDeduper(60_000, () => 0, 3);
    for (const id of ['a', 'b', 'c', 'd']) d.firstSeen(id);
    // 'a' (oldest) was evicted -> allowed to be processed again; 'd' is still retained
    expect(d.firstSeen('d')).toBe(false);
    expect(d.firstSeen('a')).toBe(true);
  });
});
