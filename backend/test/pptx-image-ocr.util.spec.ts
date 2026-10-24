import { describe, expect, it } from 'vitest';
import {
  getImageSize,
  mergeSlideOcrText,
  OCR_MAX_IMAGES_PER_DOCUMENT,
  selectImagesForOcr,
  type OcrCandidate,
  type PptxImage,
} from '../src/documents/processing/pptx-image-ocr.util.js';

function png(seed: number, width = 800, height = 300, bytes = 20_000): Buffer {
  const buf = Buffer.alloc(bytes, seed);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function jpeg(width: number, height: number, bytes = 20_000): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0)]);
  const sof = Buffer.from([
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ]);
  const head = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
  return Buffer.concat([
    head,
    Buffer.alloc(Math.max(0, bytes - head.length), 7),
  ]);
}

const img = (
  slideNumber: number,
  data: Buffer,
  mimeType = 'image/png',
): PptxImage => ({
  slideNumber,
  name: `s${slideNumber}`,
  mimeType,
  data,
});

describe('getImageSize', () => {
  it('reads PNG and JPEG; corrupted data or non-image returns null', () => {
    expect(getImageSize(png(1, 640, 480), 'image/png')).toEqual({
      width: 640,
      height: 480,
    });
    expect(getImageSize(jpeg(1024, 768), 'image/jpeg')).toEqual({
      width: 1024,
      height: 768,
    });
    expect(getImageSize(Buffer.from('không phải ảnh'), 'image/png')).toBeNull();
    expect(
      getImageSize(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'),
    ).toBeNull();
    expect(getImageSize(Buffer.alloc(30), 'image/gif')).toBeNull();
  });
});

describe('selectImagesForOcr', () => {
  it('keeps large PNG/JPEG images; skips small icons (by file size or dimensions) and unsupported formats', () => {
    const { candidates, stats } = selectImagesForOcr([
      img(1, png(1)),
      img(2, jpeg(900, 600), 'image/jpeg'),
      img(3, png(2, 64, 64, 20_000)), // cạnh ngắn < 100px
      img(3, png(3, 800, 300, 800)), // < 5KB
      img(4, Buffer.alloc(30_000), 'image/x-emf'),
    ]);
    expect(candidates.map((c) => c.slides)).toEqual([[1], [2]]);
    expect(stats).toMatchObject({
      total: 5,
      tooSmall: 2,
      unsupported: 1,
      decorative: 0,
    });
  });

  it('same content appearing on >= 3 slides is treated as decorative (logo) and skipped; 1-2 slides OCRs once and links to those slides', () => {
    const logo = png(7);
    const chart = png(8);
    const { candidates, stats } = selectImagesForOcr([
      img(1, logo),
      img(2, logo),
      img(3, logo),
      img(4, logo),
      img(2, chart),
      img(3, chart),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.slides).toEqual([2, 3]);
    expect(stats.decorative).toBe(1);
  });

  it('counts same image appearing twice on same slide once; results sorted by first slide', () => {
    const a = png(1);
    const b = png(2);
    const { candidates } = selectImagesForOcr([
      img(5, b),
      img(1, a),
      img(1, a),
    ]);
    expect(candidates.map((c) => c.slides)).toEqual([[1], [5]]);
  });

  it('truncates images when exceeding document limit and reports truncated count', () => {
    const many = Array.from(
      { length: OCR_MAX_IMAGES_PER_DOCUMENT + 5 },
      (_, i) => img(i + 1, png(i % 200, 800 + i, 300)),
    );
    const { candidates, stats } = selectImagesForOcr(many);
    expect(candidates).toHaveLength(OCR_MAX_IMAGES_PER_DOCUMENT);
    expect(stats.truncated).toBe(5);
  });

  it('returns empty array when images list is empty', () => {
    expect(selectImagesForOcr([])).toEqual({
      candidates: [],
      stats: {
        total: 0,
        unsupported: 0,
        tooSmall: 0,
        decorative: 0,
        truncated: 0,
      },
    });
  });
});

describe('mergeSlideOcrText', () => {
  const cand = (id: string, slides: number[]): OcrCandidate => ({
    id,
    data: Buffer.alloc(1),
    slides,
  });

  it('appends OCR text after existing slide text; creates new segments for image-only slides; links images across slides; results sorted by slide', () => {
    const out = mergeSlideOcrText(
      [{ pageNumber: 3, text: 'Tiêu đề' }],
      [cand('a', [1, 3]), cand('b', [2])],
      new Map([
        ['a', 'Chữ  A\ntrong ảnh'],
        ['b', 'Chữ B nữa'],
      ]),
    );
    expect(out).toEqual([
      { pageNumber: 1, text: 'Chữ trong ảnh: Chữ A trong ảnh' },
      { pageNumber: 2, text: 'Chữ trong ảnh: Chữ B nữa' },
      { pageNumber: 3, text: 'Tiêu đề\nChữ trong ảnh: Chữ A trong ảnh' },
    ]);
  });

  it('skips noisy/short OCR text and empty results; returns original slides when nothing to merge', () => {
    const slides = [{ pageNumber: 1, text: 'A' }];
    const out = mergeSlideOcrText(
      slides,
      [cand('a', [1]), cand('b', [1])],
      new Map([['a', ' | ']]),
    );
    expect(out).toBe(slides);
  });
});
