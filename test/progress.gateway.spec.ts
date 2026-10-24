import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { ProgressGateway } from '../src/realtime/progress.gateway.js';

const PAYLOAD = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'MEMBER',
};

function fakeSocket(
  handshake: {
    auth?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  return {
    id: 'sock1',
    data: {} as any,
    handshake: { auth: handshake.auth ?? {}, headers: handshake.headers ?? {} },
    emit: vi.fn(),
    join: vi.fn(async () => undefined),
    disconnect: vi.fn(),
  };
}

describe('ProgressGateway', () => {
  let jwt: { verifyAsync: Mock<(...a: any[]) => Promise<any>> };
  let gateway: ProgressGateway;

  beforeEach(() => {
    jwt = { verifyAsync: vi.fn(async () => ({ ...PAYLOAD })) };
    gateway = new ProgressGateway(jwt as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('valid token in auth.token: authenticates and joins correct tenant room from JWT', async () => {
    const s = fakeSocket({ auth: { token: 'good' } });
    await gateway.handleConnection(s as any);

    expect(jwt.verifyAsync).toHaveBeenCalledWith('good');
    expect(s.join).toHaveBeenCalledWith('tenant:t1');
    expect(s.data.tenantId).toBe('t1');
    expect(s.disconnect).not.toHaveBeenCalled();
  });

  it('accepts valid token from Authorization: Bearer header', async () => {
    const s = fakeSocket({ headers: { authorization: 'Bearer good' } });
    await gateway.handleConnection(s as any);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('good');
    expect(s.join).toHaveBeenCalledWith('tenant:t1');
  });

  it('missing token: emits auth_error and disconnects without joining room', async () => {
    const s = fakeSocket();
    await gateway.handleConnection(s as any);
    expect(s.emit).toHaveBeenCalledWith('auth_error', expect.any(Object));
    expect(s.disconnect).toHaveBeenCalledWith(true);
    expect(s.join).not.toHaveBeenCalled();
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('invalid or expired token: disconnects without leaking error details', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const s = fakeSocket({ auth: { token: 'bad' } });
    await gateway.handleConnection(s as any);

    expect(s.disconnect).toHaveBeenCalledWith(true);
    expect(s.join).not.toHaveBeenCalled();
    const [, body] = s.emit.mock.calls[0]!;
    expect(JSON.stringify(body)).not.toContain('jwt expired');
  });

  it('valid JWT missing tenantId/membershipId (wrong token type): rejected', async () => {
    jwt.verifyAsync.mockResolvedValue({ identityId: 'i1' });
    const s = fakeSocket({ auth: { token: 'odd' } });
    await gateway.handleConnection(s as any);
    expect(s.disconnect).toHaveBeenCalledWith(true);
    expect(s.join).not.toHaveBeenCalled();
  });

  it('ignores tenantId sent in client handshake, relies strictly on JWT payload', async () => {
    const s = fakeSocket({ auth: { token: 'good', tenantId: 'tenant-khac' } });
    await gateway.handleConnection(s as any);
    expect(s.join).toHaveBeenCalledTimes(1);
    expect(s.join).toHaveBeenCalledWith('tenant:t1');
  });

  it('disconnects socket when token expires so client refreshes token', async () => {
    vi.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 60;
    jwt.verifyAsync.mockResolvedValue({ ...PAYLOAD, exp });
    const s = fakeSocket({ auth: { token: 'good' } });
    await gateway.handleConnection(s as any);

    expect(s.disconnect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(61_000);
    expect(s.emit).toHaveBeenCalledWith('auth_error', {
      message: 'Access token expired',
    });
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it('client disconnects before expiration: cancels timer without leaking', async () => {
    vi.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 60;
    jwt.verifyAsync.mockResolvedValue({ ...PAYLOAD, exp });
    const s = fakeSocket({ auth: { token: 'good' } });
    await gateway.handleConnection(s as any);

    gateway.handleDisconnect(s as any);
    vi.advanceTimersByTime(120_000);
    expect(s.disconnect).not.toHaveBeenCalled();
  });

  it('emitProgress: emits document.progress event only to the specific tenant room', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    (gateway as any).server = { to };

    gateway.emitProgress('t1', {
      documentId: 'd1',
      percent: 50,
      phase: 'embedding',
    });

    expect(to).toHaveBeenCalledWith('tenant:t1');
    expect(emit).toHaveBeenCalledWith('document.progress', {
      documentId: 'd1',
      percent: 50,
      phase: 'embedding',
    });
  });
});
