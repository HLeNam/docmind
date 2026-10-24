import { describe, expect, it } from 'vitest';
import {
  SLACK_STATE_TTL_MS,
  signSlackState,
  verifySlackState,
} from '../src/slack/slack-state.util.js';

const SECRET = 'test-client-secret';

describe('slack-state.util', () => {
  it('valid state returns correct tenantId', () => {
    const state = signSlackState('tenant-1', SECRET);
    expect(verifySlackState(state, SECRET)?.tenantId).toBe('tenant-1');
  });

  it('expires after 10 minutes -> returns null', () => {
    const now = 1_000_000;
    const state = signSlackState('tenant-1', SECRET, now);
    expect(
      verifySlackState(state, SECRET, now + SLACK_STATE_TTL_MS - 1),
    ).not.toBeNull();
    expect(
      verifySlackState(state, SECRET, now + SLACK_STATE_TTL_MS + 1),
    ).toBeNull();
  });

  it('wrong signature key -> returns null', () => {
    const state = signSlackState('tenant-1', SECRET);
    expect(verifySlackState(state, 'different-key')).toBeNull();
  });

  it('tampering tenantId in body while keeping signature -> returns null', () => {
    const state = signSlackState('tenant-1', SECRET);
    const [body, signature] = state.split('.') as [string, string];
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.tenantId = 'victim-tenant';
    const forgedBody = Buffer.from(JSON.stringify(forged)).toString(
      'base64url',
    );
    expect(verifySlackState(`${forgedBody}.${signature}`, SECRET)).toBeNull();
  });

  it.each(['', 'abc', 'a.b.c', 'not-a-state.signature'])(
    'malformed string %p -> returns null without throwing',
    (junk) => {
      expect(verifySlackState(junk, SECRET)).toBeNull();
    },
  );

  it('generates distinct state each time due to nonce', () => {
    expect(signSlackState('tenant-1', SECRET)).not.toBe(
      signSlackState('tenant-1', SECRET),
    );
  });
});
