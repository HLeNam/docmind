import { describe, expect, it } from 'vitest';
import {
  OCR_LANGUAGES,
  resolveOcrWorkerOptions,
} from '../src/documents/processing/ocr-config.util.js';

describe('resolveOcrWorkerOptions', () => {
  it('returns empty options when env is not set (preserves CDN download behavior)', () => {
    expect(resolveOcrWorkerOptions({}, () => false)).toEqual({});
    expect(
      resolveOcrWorkerOptions({ OCR_LANG_PATH: '   ' }, () => false),
    ).toEqual({});
  });

  it('returns langPath and gzip when OCR_LANG_PATH contains all required files', () => {
    const seen: string[] = [];
    const opts = resolveOcrWorkerOptions(
      { OCR_LANG_PATH: '/data/tessdata' },
      (p) => {
        seen.push(p);
        return true;
      },
    );
    expect(opts).toEqual({ langPath: '/data/tessdata', gzip: true });
    expect(seen).toEqual([
      '/data/tessdata/eng.traineddata.gz',
      '/data/tessdata/vie.traineddata.gz',
    ]);
  });

  it('throws when required files are missing, indicating missing files and download script', () => {
    const fn = () =>
      resolveOcrWorkerOptions({ OCR_LANG_PATH: '/x' }, (p) =>
        p.endsWith('eng.traineddata.gz'),
      );
    expect(fn).toThrow(/vie\.traineddata\.gz/);
    expect(fn).toThrow(/download-tessdata/);
    expect(fn).not.toThrow(/eng\.traineddata\.gz,/);
  });

  it('passes OCR_CACHE_PATH independently of langPath', () => {
    expect(
      resolveOcrWorkerOptions({ OCR_CACHE_PATH: '/tmp/ocr' }, () => false),
    ).toEqual({ cachePath: '/tmp/ocr' });
    expect(
      resolveOcrWorkerOptions(
        { OCR_LANG_PATH: '/d', OCR_CACHE_PATH: '/tmp/ocr' },
        () => true,
      ),
    ).toEqual({
      cachePath: '/tmp/ocr',
      langPath: '/d',
      gzip: true,
    });
  });

  it('configures default languages as eng+vie', () => {
    expect(OCR_LANGUAGES).toBe('eng+vie');
  });
});
