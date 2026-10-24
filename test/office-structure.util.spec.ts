// Fixture mô phỏng ĐÚNG hình dạng AST của officeparser@8.1.1 (đã dump từ file pptx/xlsx thật khi viết util này).
import { describe, expect, it } from 'vitest';
import {
  imagesFromAst,
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
  it('reads slide numbers from metadata.slideNumber (empty slides are skipped and not counted by array index)', () => {
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

  it('table -> one row per line, cells separated by " | "; does not duplicate child node text', () => {
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

  it('speaker notes are appended to the end of the slide', () => {
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

  it('unknown container (no text) -> recurses into children; slide without text or invalid slide number -> skipped', () => {
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

  it('empty AST -> empty array', () => {
    expect(slidesFromAst([])).toEqual([]);
  });
});

describe('sheetsFromAst', () => {
  const row = (...cells: OfficeNode[]): OfficeNode => ({
    type: 'row',
    children: cells,
  });

  it('1-based row numbers from metadata.row; blank cells between rows retain correct columns; blank rows are skipped', () => {
    // Hàng Excel 1: A,B,C | hàng 2: x,(trống),z | hàng 3 trống (không xuất hiện) | hàng 4: y,w,3.5
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

  it('multiple sheets; empty sheets skipped; missing sheet name -> "Sheet N"', () => {
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

describe('imagesFromAst', () => {
  const img = (attachmentName: string): OfficeNode => ({
    type: 'image',
    text: '',
    metadata: { attachmentName },
  });
  const att = (name: string, type = 'image', mimeType = 'image/png') => ({
    type,
    mimeType,
    name,
    data: Buffer.from('PNGDATA').toString('base64'),
  });

  it('matches slide image nodes with attachments by name; decodes base64; recurses into groups/tables', () => {
    const out = imagesFromAst(
      [
        {
          type: 'slide',
          metadata: { slideNumber: 2 },
          children: [
            heading('A'),
            img('image1.png'),
            { type: 'group', children: [img('image2.png')] },
          ],
        },
        {
          type: 'slide',
          metadata: { slideNumber: 5 },
          children: [img('image1.png')],
        },
      ],
      [att('image1.png'), att('image2.png', 'image', 'image/jpeg')],
    );
    expect(out.map((i) => [i.slideNumber, i.name, i.mimeType])).toEqual([
      [2, 'image1.png', 'image/png'],
      [2, 'image2.png', 'image/jpeg'],
      [5, 'image1.png', 'image/png'],
    ]);
    expect(out[0]!.data.toString()).toBe('PNGDATA');
  });

  it('skips images not in attachments, chart attachments, and slides without valid numbers', () => {
    const out = imagesFromAst(
      [
        {
          type: 'slide',
          metadata: { slideNumber: 1 },
          children: [img('missing.png'), img('chart1')],
        },
        { type: 'slide', metadata: {}, children: [img('image1.png')] },
      ],
      [att('image1.png'), att('chart1', 'chart')],
    );
    expect(out).toEqual([]);
  });
});
