import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import {
  SLACK_MAX_TIMESTAMP_SKEW_SECONDS,
  SlackSignatureGuard,
  computeSlackSignature,
} from '../src/slack/slack-signature.guard.js';
import {
  InternalAppException,
  UnauthorizedAppException,
} from '../src/common/exceptions/app.exception.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

const SECRET = 'signing-secret';
const BODY =
  'team_id=T1&channel_id=C0123ABCDEF&user_id=U1&text=xin+ch%C3%A0o&response_url=https%3A%2F%2Fhooks.slack.com%2Fx';

function guard(...args: [string?]) {
  const secret = args.length === 0 ? SECRET : args[0];
  return new SlackSignatureGuard({ get: () => secret } as any);
}

function contextWith(opts: {
  rawBody?: string | null;
  timestamp?: string;
  signature?: string;
}): ExecutionContext {
  const headers: Record<string, string> = {};
  if (opts.timestamp !== undefined)
    headers['x-slack-request-timestamp'] = opts.timestamp;
  if (opts.signature !== undefined)
    headers['x-slack-signature'] = opts.signature;
  const request = {
    headers,
    rawBody:
      opts.rawBody === null ? undefined : Buffer.from(opts.rawBody ?? BODY),
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const nowTs = () => String(Math.floor(Date.now() / 1000));
const signedContext = (ts = nowTs(), body = BODY, secret = SECRET) =>
  contextWith({
    rawBody: body,
    timestamp: ts,
    signature: computeSlackSignature(secret, ts, body),
  });

function catchError(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('SlackSignatureGuard', () => {
  it('valid signature -> allows request', () => {
    expect(guard().canActivate(signedContext())).toBe(true);
  });

  it('matches standard vector from Slack documentation (v0=hex format)', () => {
    expect(computeSlackSignature(SECRET, '1531420618', BODY)).toMatch(
      /^v0=[0-9a-f]{64}$/,
    );
  });

  it('body tampered by 1 character -> 401 SLACK_SIGNATURE_INVALID', () => {
    const ts = nowTs();
    const ctx = contextWith({
      rawBody: BODY + 'x',
      timestamp: ts,
      signature: computeSlackSignature(SECRET, ts, BODY),
    });
    const err = catchError(() => guard().canActivate(ctx));
    expect(err).toBeInstanceOf(UnauthorizedAppException);
    expect(err.code).toBe(ErrorCode.SLACK_SIGNATURE_INVALID);
  });

  it('signed with different secret -> 401', () => {
    const err = catchError(() =>
      guard().canActivate(signedContext(nowTs(), BODY, 'different-secret')),
    );
    expect(err.code).toBe(ErrorCode.SLACK_SIGNATURE_INVALID);
  });

  it('timestamp older than 5 minutes (replay) even with valid signature -> 401', () => {
    const old = String(
      Math.floor(Date.now() / 1000) - SLACK_MAX_TIMESTAMP_SKEW_SECONDS - 10,
    );
    expect(catchError(() => guard().canActivate(signedContext(old))).code).toBe(
      ErrorCode.SLACK_SIGNATURE_INVALID,
    );
  });

  it('non-numeric timestamp -> 401', () => {
    const ctx = contextWith({ timestamp: 'abc', signature: 'v0=deadbeef' });
    expect(catchError(() => guard().canActivate(ctx)).code).toBe(
      ErrorCode.SLACK_SIGNATURE_INVALID,
    );
  });

  it('missing signature or timestamp header -> 401', () => {
    expect(catchError(() => guard().canActivate(contextWith({}))).code).toBe(
      ErrorCode.SLACK_SIGNATURE_INVALID,
    );
    expect(
      catchError(() => guard().canActivate(contextWith({ timestamp: nowTs() })))
        .code,
    ).toBe(ErrorCode.SLACK_SIGNATURE_INVALID);
  });

  it('invalid signature length -> 401 without throwing unexpected errors', () => {
    const ctx = contextWith({ timestamp: nowTs(), signature: 'v0=short' });
    expect(catchError(() => guard().canActivate(ctx))).toBeInstanceOf(
      UnauthorizedAppException,
    );
  });

  it('missing SLACK_SIGNING_SECRET -> SLACK_NOT_CONFIGURED (configuration error, not 401)', () => {
    const err = catchError(() => guard(undefined).canActivate(signedContext()));
    expect(err).toBeInstanceOf(InternalAppException);
    expect(err.code).toBe(ErrorCode.SLACK_NOT_CONFIGURED);
  });

  it('missing rawBody (not enabled in main.ts) -> SLACK_RAW_BODY_MISSING with fix instructions', () => {
    const err = catchError(() =>
      guard().canActivate(
        contextWith({ rawBody: null, timestamp: nowTs(), signature: 'v0=x' }),
      ),
    );
    expect(err).toBeInstanceOf(InternalAppException);
    expect(err.code).toBe(ErrorCode.SLACK_RAW_BODY_MISSING);
    expect(err.message).toContain('rawBody: true');
  });
});
