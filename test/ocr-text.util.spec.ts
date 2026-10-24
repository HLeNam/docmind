import { describe, expect, it } from 'vitest';
import {
  diceSimilarity,
  isNoiseLine,
  mergeOcrPasses,
  normalizeOcrLine,
} from '../src/documents/processing/ocr-text.util.js';

describe('normalizeOcrLine', () => {
  it('strips Vietnamese diacritics, maps đ to d, lowercases, and keeps only alphanumeric', () => {
    expect(normalizeOcrLine('KHOA CHÍNH TRỊ - HÀNH CHÍNH')).toBe(
      'khoachinhtrihanhchinh',
    );
    expect(normalizeOcrLine('Đại học Quốc gia')).toBe('daihocquocgia');
  });
});

describe('isNoiseLine', () => {
  it.each(['', '   ', '|', 'a', '--', 'ab', '= ~ ~ |', '¥ ~ § ® a |'])(
    'identifies %p as noise',
    (line) => {
      expect(isNoiseLine(line)).toBe(true);
    },
  );
  it.each([
    'KHOA CHINH TRI - HANH CHINH',
    'CHỦ NGHĨA XÃ HỘI KHOA HỌC',
    'Giáo trình 2021',
  ])('retains %p', (line) => {
    expect(isNoiseLine(line)).toBe(false);
  });
});

describe('diceSimilarity', () => {
  it('returns 1 for exact match, low for distinct strings, high for near-matches', () => {
    expect(diceSimilarity('abcdef', 'abcdef')).toBe(1);
    expect(diceSimilarity('chunghiaxahoikhoahoc', 'chunghiaxahoikhoahoc')).toBe(
      1,
    );
    expect(
      diceSimilarity('chunghiaxahoikhoahoc', 'chunghiaaxahoikhoahoc'),
    ).toBeGreaterThan(0.9);
    expect(diceSimilarity('khoachinhtri', 'zzzzqqqq')).toBeLessThan(0.2);
  });
});

describe('mergeOcrPasses', () => {
  // Dữ liệu thật đo trên slide tiêu đề (tesseract.js, eng): ảnh gốc chỉ ra 2 dòng giữa slide; ảnh đảo màu (PSM 11)
  // đọc thêm phần header chữ trắng trên nền xanh.
  const original = 'CHU NGHIA X& HOI KHOA HOC\nCS. Mach Chi Khinh Crinh';
  const inverted =
    'DAI HOC QUOC GIA TP HO CHI MINH\nKHOA\nSaJA\\S\n- HANH CHI\nKHOA CHINH TRI - HANH CHINH\nCHU NGHIA X& HOI KHOA HOC\nCS. Mach Chi Khinh Crinh';

  it('extracts lines discovered only in inverted pass without duplicating existing lines', () => {
    const lines = mergeOcrPasses([original, inverted]).split('\n');
    expect(lines).toContain('KHOA CHINH TRI - HANH CHINH');
    expect(lines).toContain('DAI HOC QUOC GIA TP HO CHI MINH');
    expect(lines.filter((l) => l === 'CHU NGHIA X& HOI KHOA HOC')).toHaveLength(
      1,
    );
    expect(lines.filter((l) => l.startsWith('CS. Mach'))).toHaveLength(1);
  });

  it('replaces fragmented lines with full lines, avoiding standalone fragments', () => {
    const lines = mergeOcrPasses([original, inverted]).split('\n');
    expect(lines).not.toContain('KHOA');
    expect(lines).not.toContain('- HANH CHI');
  });

  it('preserves order: first-pass lines appear first', () => {
    const lines = mergeOcrPasses([original, inverted]).split('\n');
    expect(lines[0]).toBe('CHU NGHIA X& HOI KHOA HOC');
  });

  it('deduplicates passes differing by few characters on the same line, keeping first pass', () => {
    const merged = mergeOcrPasses([
      'CHU NGHIA X& HOI KHOA HOC',
      'CHU NGHIA A*& HOI KHOA HOC',
    ]);
    expect(merged).toBe('CHU NGHIA X& HOI KHOA HOC');
  });

  it('strips noise lines; returns empty string when all noise or empty', () => {
    expect(mergeOcrPasses(['| ~ ~\n= a', '\n  \n'])).toBe('');
    expect(mergeOcrPasses([])).toBe('');
  });

  it('retains both completely distinct lines', () => {
    expect(
      mergeOcrPasses([
        'Giao trinh Tu tuong Ho Chi Minh',
        'Nha xuat ban Chinh tri Quoc gia',
      ]),
    ).toBe('Giao trinh Tu tuong Ho Chi Minh\nNha xuat ban Chinh tri Quoc gia');
  });

  it('cleans up redundant whitespace and blank lines on a single pass', () => {
    expect(mergeOcrPasses(['  Dòng   một  \n\n  Dòng hai  '])).toBe(
      'Dòng một\nDòng hai',
    );
  });
});
