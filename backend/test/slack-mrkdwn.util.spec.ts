import { describe, expect, it } from 'vitest';
import {
  buildAnswerBlocks,
  escapeSlackText,
  markdownToSlackMrkdwn,
  selectCitationsToShow,
  type SlackCitation,
} from '../src/slack/slack-mrkdwn.util.js';

const cite = (
  index: number,
  over: Partial<SlackCitation> = {},
): SlackCitation => ({
  index,
  filename: `file${index}.pdf`,
  pageNumber: null,
  headingContext: null,
  ...over,
});

describe('markdownToSlackMrkdwn', () => {
  it('**bold** -> *bold*', () => {
    expect(markdownToSlackMrkdwn('There are **3 main types**')).toBe(
      'There are *3 main types*',
    );
  });

  it('bullet "* x" and "- x" -> "• x", including nested bold', () => {
    const out = markdownToSlackMrkdwn(
      '* **Supervised** (supervised) [2]\n- Unsupervised [2]',
    );
    expect(out).toBe('• *Supervised* (supervised) [2]\n• Unsupervised [2]');
  });

  it('heading # -> bold', () => {
    expect(markdownToSlackMrkdwn('## Overview\nContent')).toBe(
      '*Overview*\nContent',
    );
  });

  it('escapes & < > so LLM-generated mentions or links are neutralized', () => {
    const out = markdownToSlackMrkdwn('Ask <!channel> and <@U123> about A & B');
    expect(out).toBe('Ask &lt;!channel&gt; and &lt;@U123&gt; about A &amp; B');
    expect(out).not.toContain('<!channel>');
  });

  it('escapeSlackText does not touch other characters', () => {
    expect(escapeSlackText('a * b _c_ `d`')).toBe('a * b _c_ `d`');
  });
});

describe('selectCitationsToShow', () => {
  const all = [cite(1), cite(2), cite(3), cite(4), cite(5)];

  it('only keeps citations referenced in the answer', () => {
    expect(
      selectCitationsToShow('Correct [2] and [4].', all).map((c) => c.index),
    ).toEqual([2, 4]);
  });

  it('when no numbers are cited -> shows first 3 citations', () => {
    expect(
      selectCitationsToShow('Not found in docs.', all).map((c) => c.index),
    ).toEqual([1, 2, 3]);
  });

  it('citing non-existent number (e.g. [9]) -> treated as not citing', () => {
    expect(selectCitationsToShow('See [9].', all).map((c) => c.index)).toEqual([
      1, 2, 3,
    ]);
  });

  it('empty citations array -> returns empty array', () => {
    expect(selectCitationsToShow('Not found.', [])).toEqual([]);
  });
});

describe('buildAnswerBlocks', () => {
  it('answer section + divider + citation context (filename, page, stripped heading)', () => {
    const { blocks, text } = buildAnswerBlocks('There are 3 types of **ML** [1] [2]', [
      cite(1, { pageNumber: 7 }),
      cite(2, { filename: 'a&b.docx', headingContext: '### 1. Concept' }),
    ]) as { blocks: any[]; text: string };

    expect(blocks.map((b) => b.type)).toEqual([
      'section',
      'divider',
      'context',
    ]);
    expect(blocks[0].text).toEqual({
      type: 'mrkdwn',
      text: 'There are 3 types of *ML* [1] [2]',
    });
    const sources: string = blocks[2].elements[0].text;
    expect(sources).toContain('*Nguồn*');
    expect(sources).toContain('[1] file1.pdf — trang 7');
    expect(sources).toContain('[2] a&amp;b.docx — 1. Concept');
    expect(text).toBe('There are 3 types of *ML* [1] [2]');
  });

  it('no citations -> only section, without divider or context', () => {
    const { blocks } = buildAnswerBlocks('No information found.', []) as {
      blocks: any[];
    };
    expect(blocks.map((b) => b.type)).toEqual(['section']);
  });

  it('empty answer -> fallback text, does not send empty section (rejected by Slack)', () => {
    const { blocks } = buildAnswerBlocks('   ', []) as { blocks: any[] };
    expect(blocks[0].text.text).toBe('(Không có câu trả lời)');
  });

  it('long answer is split into multiple sections, each <= 3000 chars', () => {
    const paragraph = 'x'.repeat(1500);
    const answer = [paragraph, paragraph, paragraph, paragraph].join('\n\n');
    const { blocks } = buildAnswerBlocks(answer, []) as { blocks: any[] };
    const sections = blocks.filter((b) => b.type === 'section');
    expect(sections.length).toBeGreaterThan(1);
    for (const s of sections)
      expect(s.text.text.length).toBeLessThanOrEqual(3000);
  });

  it('single paragraph longer than limit is split without losing text', () => {
    const answer = 'y'.repeat(7000);
    const { blocks } = buildAnswerBlocks(answer, []) as { blocks: any[] };
    const joined = blocks.map((b) => b.text.text).join('');
    expect(joined).toHaveLength(7000);
    for (const b of blocks)
      expect(b.text.text.length).toBeLessThanOrEqual(3000);
  });

  it('fallback text is truncated to 300 chars', () => {
    const { text } = buildAnswerBlocks('z'.repeat(1000), []);
    expect(text).toHaveLength(300);
  });
});
