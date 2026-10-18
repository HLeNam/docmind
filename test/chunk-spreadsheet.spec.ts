import { describe, expect, it } from 'vitest';
import { chunkSpreadsheet } from '../src/documents/processing/chunk-text.util.js';

const rows = (n: number, from = 2) =>
  Array.from({ length: n }, (_, i) => ({
    rowNumber: from + i,
    cells: [`T${i + 1}`, String((i + 1) * 100)],
  }));

describe('chunkSpreadsheet', () => {
  it('small sheet -> 1 chunk with sheet name, header row, data rows, and row range headingContext', () => {
    const chunks = chunkSpreadsheet([
      {
        name: 'Doanh thu',
        rows: [{ rowNumber: 1, cells: ['Tháng', 'Doanh thu'] }, ...rows(3)],
      },
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(
      '[Sheet: Doanh thu]\nTháng | Doanh thu\nT1 | 100\nT2 | 200\nT3 | 300',
    );
    expect(chunks[0]!.headingContext).toBe('Sheet "Doanh thu" · hàng 2–4');
    expect(chunks[0]!.chunkIndex).toBe(0);
  });

  it('single data row -> "hàng N" without range', () => {
    const [c] = chunkSpreadsheet([
      {
        name: 'S',
        rows: [
          { rowNumber: 1, cells: ['A'] },
          { rowNumber: 5, cells: ['x'] },
        ],
      },
    ]);
    expect(c!.headingContext).toBe('Sheet "S" · hàng 5');
  });

  it('sheet with only header row -> still produces 1 chunk', () => {
    const chunks = chunkSpreadsheet([
      { name: 'S', rows: [{ rowNumber: 1, cells: ['A', 'B'] }] },
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.headingContext).toBe('Sheet "S" · hàng 1');
  });

  it('large sheet -> splits into multiple chunks repeating header row with contiguous row ranges', () => {
    const data = rows(400);
    const chunks = chunkSpreadsheet([
      {
        name: 'Lớn',
        rows: [{ rowNumber: 1, cells: ['Tháng', 'Doanh thu'] }, ...data],
      },
    ]);

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks)
      expect(c.content.startsWith('[Sheet: Lớn]\nTháng | Doanh thu\n')).toBe(
        true,
      );

    const ranges = chunks.map(
      (c) =>
        /hàng (\d+)–(\d+)/.exec(c.headingContext!)!.slice(1).map(Number) as [
          number,
          number,
        ],
    );
    expect(ranges[0]![0]).toBe(2);
    expect(ranges[ranges.length - 1]![1]).toBe(401);
    for (let i = 1; i < ranges.length; i++)
      expect(ranges[i]![0]).toBe(ranges[i - 1]![1] + 1);
  });

  it('increments chunkIndex monotonically across multiple sheets', () => {
    const chunks = chunkSpreadsheet([
      { name: 'A', rows: [{ rowNumber: 1, cells: ['h'] }, ...rows(2)] },
      { name: 'B', rows: [{ rowNumber: 1, cells: ['h'] }, ...rows(2)] },
    ]);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1]);
    expect(chunks.map((c) => c.headingContext!.split(' · ')[0])).toEqual([
      'Sheet "A"',
      'Sheet "B"',
    ]);
  });

  it('single row exceeding chunk size -> splits with sliding window while preserving row label', () => {
    const longCell = 'từ '.repeat(3000);
    const chunks = chunkSpreadsheet([
      {
        name: 'Ghi chú',
        rows: [
          { rowNumber: 1, cells: ['Nội dung'] },
          { rowNumber: 2, cells: ['ngắn'] },
          { rowNumber: 3, cells: [longCell] },
        ],
      },
    ]);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]!.headingContext).toBe('Sheet "Ghi chú" · hàng 2');
    expect(
      chunks
        .slice(1)
        .every((c) => c.headingContext === 'Sheet "Ghi chú" · hàng 3'),
    ).toBe(true);
  });

  it('returns empty array when sheets array is empty', () => {
    expect(chunkSpreadsheet([])).toEqual([]);
  });
});
