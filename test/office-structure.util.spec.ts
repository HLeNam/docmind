// Fixture accurately simulates officeparser@8.1.1 AST structure.
import { describe, expect, it } from 'vitest';
import {
  sheetsFromAst,
  slidesFromAst,
  type OfficeNode,
} from '../src/documents/processing/office-structure.util.js';

const text = (t: string): OfficeNode => ({ type: 'text', text: t });
const para = (t: string): OfficeNode => ({
  type: 'paragraph',
  text: t,
  children: [text(t)],
});
const heading = (t: string): OfficeNode => ({
  type: 'heading',
  text: t,
  metadata: { level: 1 },
  children: [text(t)],
});
const cell = (t: string, row: number, col: number): OfficeNode => ({
  type: 'cell',
  text: t,
  metadata: { row, col },
  children: [para(t)],
});

describe('slidesFromAst', () => {
  it('extracts slide number from metadata.slideNumber, skipping empty slides', () => {
    const out = slidesFromAst([
      {
        type: 'slide',
        metadata: { slideNumber: 1 },
        children: [heading('Giới thiệu'), para('Nội dung A')],
      },
      {
        type: 'slide',
        metadata: { slideNumber: 4 },
        children: [heading('Kết luận')],
      },
    ]);
    expect(out).toEqual([
      { pageNumber: 1, text: 'Giới thiệu\nNội dung A' },
      { pageNumber: 4, text: 'Kết luận' },
    ]);
  });

  it('formats tables with one line per row, cells separated by " | " without repeating child text', () => {
    const table: OfficeNode = {
      type: 'table',
      children: [
        { type: 'row', children: [cell('Loại', 0, 0), cell('Ví dụ', 0, 1)] },
        {
          type: 'row',
          children: [cell('Supervised', 1, 0), cell('Phân loại', 1, 1)],
        },
      ],
    };
    const [slide] = slidesFromAst([
      {
        type: 'slide',
        metadata: { slideNumber: 2 },
        children: [heading('So sánh'), table],
      },
    ]);
    expect(slide!.text).toBe('So sánh\nLoại | Ví dụ\nSupervised | Phân loại');
  });

  it('appends speaker notes to the end of the slide', () => {
    const [slide] = slidesFromAst([
      {
        type: 'slide',
        metadata: { slideNumber: 1 },
        children: [para('Nội dung')],
        notes: [{ type: 'note', children: [para('Nhớ nhấn mạnh điểm này')] }],
      },
    ]);
    expect(slide!.text).toBe('Nội dung\nGhi chú: Nhớ nhấn mạnh điểm này');
  });

  it('recursively traverses unknown container nodes and skips slides without text or with invalid slide numbers', () => {
    const out = slidesFromAst([
      {
        type: 'slide',
        metadata: { slideNumber: 1 },
        children: [{ type: 'group', children: [para('Trong nhóm')] }],
      },
      { type: 'slide', metadata: { slideNumber: 2 }, children: [] },
      { type: 'slide', metadata: {}, children: [para('thiếu số')] },
      { type: 'notASlide', children: [para('x')] },
    ]);
    expect(out).toEqual([{ pageNumber: 1, text: 'Trong nhóm' }]);
  });

  it('returns empty array when AST is empty', () => {
    expect(slidesFromAst([])).toEqual([]);
  });
});

describe('sheetsFromAst', () => {
  const row = (...cells: OfficeNode[]): OfficeNode => ({
    type: 'row',
    children: cells,
  });

  it('uses 1-based row numbers from metadata.row, preserves empty cells in row, and skips empty rows', () => {
    // Excel row 1: A,B,C | row 2: x,(empty),z | row 3 empty (absent) | row 4: y,w,3.5
    const out = sheetsFromAst([
      {
        type: 'sheet',
        metadata: { sheetName: 'S' },
        children: [
          row(cell('A', 0, 0), cell('B', 0, 1), cell('C', 0, 2)),
          row(cell('x', 1, 0), cell('z', 1, 2)),
          row(cell('y', 3, 0), cell('w', 3, 1), cell('3.5', 3, 2)),
        ],
      },
    ]);
    expect(out).toEqual([
      {
        name: 'S',
        rows: [
          { rowNumber: 1, cells: ['A', 'B', 'C'] },
          { rowNumber: 2, cells: ['x', '', 'z'] },
          { rowNumber: 4, cells: ['y', 'w', '3.5'] },
        ],
      },
    ]);
  });

  it('processes multiple sheets, skips empty sheets, and defaults missing sheet name to "Sheet N"', () => {
    const out = sheetsFromAst([
      {
        type: 'sheet',
        metadata: { sheetName: 'Có dữ liệu' },
        children: [row(cell('a', 0, 0))],
      },
      { type: 'sheet', metadata: { sheetName: 'Trống' } },
      { type: 'sheet', metadata: {}, children: [row(cell('b', 0, 0))] },
    ]);
    expect(out.map((s) => s.name)).toEqual(['Có dữ liệu', 'Sheet 2']);
  });
});
