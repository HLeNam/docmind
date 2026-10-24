import { describe, expect, it } from 'vitest';
import {
  THREAD_HISTORY_MAX_CHARS,
  buildThreadHistory,
} from '../src/slack/slack-thread-history.util.js';

const BOT = 'U0BOT123';
const ts = (n: number) => `1700000${String(n).padStart(3, '0')}.000100`;

const human = (n: number, text: string, user = 'U1') => ({
  ts: ts(n),
  user,
  text,
});
const botMsg = (n: number, text: string, blocks?: unknown[]) => ({
  ts: ts(n),
  user: BOT,
  bot_id: 'B1',
  text,
  blocks,
});
const answerBlocks = (answer: string) => [
  { type: 'section', text: { type: 'mrkdwn', text: answer } },
  { type: 'divider' },
  {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: '*Nguồn*\n[1] a.pdf' }],
  },
];

describe('buildThreadHistory', () => {
  it('thread starting with @mention: question (user) + answer (assistant), strips bot mention', () => {
    const history = buildThreadHistory(
      [
        human(1, `<@${BOT}> Có những loại ML nào?`),
        botMsg(2, 'fallback', answerBlocks('Có *3 loại* [1]')),
        human(3, `<@${BOT}> còn loại thứ hai?`), // current message
      ],
      { botUserId: BOT, currentTs: ts(3) },
    );
    expect(history).toEqual([
      { role: 'user', content: 'Có những loại ML nào?' },
      { role: 'assistant', content: 'Có *3 loại* [1]' },
    ]);
  });

  it('thread starting from /ask: bot echo message treated as user turn, strips ">" prefix', () => {
    const history = buildThreadHistory(
      [
        botMsg(1, '*<@U1> hỏi:*\n> Có những loại ML nào?\n> Nói ngắn thôi'),
        botMsg(2, 'x', answerBlocks('Có 3 loại [1]')),
        human(3, `<@${BOT}> loại đầu tiên?`),
      ],
      { botUserId: BOT, currentTs: ts(3) },
    );
    expect(history).toEqual([
      { role: 'user', content: 'Có những loại ML nào?\nNói ngắn thôi' },
      { role: 'assistant', content: 'Có 3 loại [1]' },
    ]);
  });

  it('only extracts answer text from blocks before divider, excludes "Sources" block', () => {
    const [assistant] = buildThreadHistory(
      [botMsg(1, 'x', answerBlocks('Nội dung'))],
      {
        botUserId: BOT,
        currentTs: ts(2),
      },
    );
    expect(assistant!.content).toBe('Nội dung');
    expect(assistant!.content).not.toContain('Nguồn');
  });

  it('strips "Interpreted question as" context block and decodes &amp; &lt; &gt;', () => {
    const blocks = [
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '_Hiểu câu hỏi là: abc_' }],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'A &amp; B &lt;x&gt;' },
      },
    ];
    const [assistant] = buildThreadHistory([botMsg(1, 'x', blocks)], {
      botUserId: BOT,
      currentTs: ts(2),
    });
    expect(assistant!.content).toBe('A & B <x>');
  });

  it('user-to-user conversation without bot mention -> ignored', () => {
    const history = buildThreadHistory(
      [
        human(1, `<@${BOT}> ML là gì?`),
        botMsg(2, 'x', answerBlocks('Là học máy')),
        human(3, 'cảm ơn nhé, hay quá'),
        human(4, '<@U9> xem cái này giúp mình'), // mentions someone else, not bot
      ],
      { botUserId: BOT, currentTs: ts(5) },
    );
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('bot error message -> ignored', () => {
    const history = buildThreadHistory(
      [
        human(1, `<@${BOT}> ML là gì?`),
        botMsg(
          2,
          'Xin lỗi, DocMind gặp lỗi khi tìm câu trả lời. Vui lòng thử lại sau.',
        ),
      ],
      { botUserId: BOT, currentTs: ts(3) },
    );
    expect(history).toEqual([{ role: 'user', content: 'ML là gì?' }]);
  });

  it('only includes messages strictly BEFORE currentTs', () => {
    const history = buildThreadHistory(
      [
        human(1, `<@${BOT}> câu 1`),
        human(2, `<@${BOT}> câu 2`),
        human(3, `<@${BOT}> câu 3`),
      ],
      { botUserId: BOT, currentTs: ts(2) },
    );
    expect(history).toEqual([{ role: 'user', content: 'câu 1' }]);
  });

  it('out-of-order messages are correctly sorted by ts', () => {
    const history = buildThreadHistory(
      [botMsg(2, 'x', answerBlocks('trả lời')), human(1, `<@${BOT}> hỏi`)],
      { botUserId: BOT, currentTs: ts(3) },
    );
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('only retains last N messages, truncating each message to char limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      human(i + 1, `<@${BOT}> câu ${i + 1}`),
    );
    const history = buildThreadHistory(many, {
      botUserId: BOT,
      currentTs: ts(20),
      maxMessages: 3,
    });
    expect(history.map((m) => m.content)).toEqual(['câu 8', 'câu 9', 'câu 10']);

    const [long] = buildThreadHistory(
      [human(1, `<@${BOT}> ${'x'.repeat(5000)}`)],
      { botUserId: BOT, currentTs: ts(2) },
    );
    expect(long!.content.length).toBeLessThanOrEqual(
      THREAD_HISTORY_MAX_CHARS + 1,
    );
  });

  it('unknown bot id: detects bot messages by bot_id, user messages only when starting with mention', () => {
    const history = buildThreadHistory(
      [
        human(1, `<@${BOT}> ML là gì?`),
        {
          ts: ts(2),
          bot_id: 'B1',
          text: 'x',
          blocks: answerBlocks('Là học máy'),
        },
        human(3, 'bình luận khác'),
      ],
      { currentTs: ts(4) },
    );
    expect(history).toEqual([
      { role: 'user', content: 'ML là gì?' },
      { role: 'assistant', content: 'Là học máy' },
    ]);
  });
});
