import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_TITLE_MAX_CHARS,
  deriveConversationTitle,
} from '../src/chat/conversation-title.util.js';

describe('deriveConversationTitle', () => {
  it('keeps short content as is', () => {
    expect(deriveConversationTitle('What is the leave request process?')).toBe(
      'What is the leave request process?',
    );
  });

  it('collapses newlines and excessive whitespace', () => {
    expect(deriveConversationTitle('  ML  is\n\n what ?  ')).toBe('ML is what ?');
  });

  it('returns null for empty or whitespace-only content', () => {
    expect(deriveConversationTitle('   \n ')).toBeNull();
  });

  it('truncates content exceeding max limit and ends with ellipsis', () => {
    const t = deriveConversationTitle('a'.repeat(200))!;
    expect(Array.from(t)).toHaveLength(CONVERSATION_TITLE_MAX_CHARS);
    expect(t.endsWith('…')).toBe(true);
  });

  it('preserves surrogate pairs without splitting emojis', () => {
    const t = deriveConversationTitle('😀'.repeat(100))!;
    expect(Array.from(t)).toHaveLength(CONVERSATION_TITLE_MAX_CHARS);
    expect(t).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // no unpaired high surrogate
  });
});
