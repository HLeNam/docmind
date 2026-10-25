import { describe, expect, it } from 'vitest';
import { StreamableFile } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { 'x-request-id': 'req-123' },
      }),
    }),
  } as any;

  it('wraps standard data into { success: true, data, meta }', async () => {
    const next = {
      handle: () => of({ name: 'DocMind' }),
    };

    const observable = interceptor.intercept(mockContext, next as any);
    const result = (await firstValueFrom(observable)) as any;

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'DocMind' });
    expect(result.meta.requestId).toBe('req-123');
  });

  it('bypasses wrapping when data is an instance of StreamableFile', async () => {
    const streamable = new StreamableFile(Buffer.from('hello'));
    const next = {
      handle: () => of(streamable),
    };

    const observable = interceptor.intercept(mockContext, next as any);
    const result = await firstValueFrom(observable);

    expect(result).toBe(streamable);
    expect(result instanceof StreamableFile).toBe(true);
  });
});
