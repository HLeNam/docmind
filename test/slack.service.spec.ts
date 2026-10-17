import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SlackService } from '../src/slack/slack.service.js';
import { SlackCryptoService } from '../src/slack/slack-crypto.service.js';
import { signSlackState } from '../src/slack/slack-state.util.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

const CONFIG: Record<string, string> = {
  SLACK_CLIENT_ID: 'cid',
  SLACK_CLIENT_SECRET: 'csecret',
  SLACK_REDIRECT_URI: 'https://example.test/slack/oauth/callback',
  SLACK_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};
const caller = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'OWNER',
};

describe('SlackService', () => {
  let tx: any;
  let system: any;
  let api: {
    exchangeCode: Mock<(...a: any[]) => Promise<any>>;
    revokeToken: Mock<(...a: any[]) => Promise<void>>;
  };
  let crypto: SlackCryptoService;
  let service: SlackService;

  beforeEach(() => {
    tx = {
      slackIntegration: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      slackChannelMapping: { deleteMany: vi.fn() },
    };
    const prisma: any = {
      runInTenantContext: vi.fn(
        async (_t: string, fn: (t: unknown) => unknown) => fn(tx),
      ),
    };
    system = { slackIntegration: { findUnique: vi.fn(async () => null) } };
    api = {
      exchangeCode: vi.fn(async () => ({
        ok: true,
        access_token: 'xoxb-secret-token',
        team: { id: 'T123', name: 'Test WS' },
      })),
      revokeToken: vi.fn(async () => undefined),
    };
    const config: any = { get: (k: string) => CONFIG[k] };
    crypto = new SlackCryptoService(config);
    service = new SlackService(prisma, system, crypto, api as any, config);
  });

  describe('buildInstallUrl', () => {
    it('points to Slack with client_id, scope, redirect_uri, and tenant-bound state', () => {
      const { url } = service.buildInstallUrl(caller);
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        'https://slack.com/oauth/v2/authorize',
      );
      expect(parsed.searchParams.get('client_id')).toBe('cid');
      expect(parsed.searchParams.get('scope')).toBe('commands,chat:write');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        CONFIG.SLACK_REDIRECT_URI,
      );
      expect(parsed.searchParams.get('state')).toBeTruthy();
    });

    it('missing configuration -> throws SLACK_NOT_CONFIGURED', () => {
      const empty: any = { get: () => undefined };
      const unconfigured = new SlackService(
        {} as any,
        system,
        crypto,
        api as any,
        empty,
      );
      expect(() => unconfigured.buildInstallUrl(caller)).toThrow(
        /not configured/,
      );
    });
  });

  describe('completeInstall', () => {
    const goodState = () => signSlackState('t1', 'csecret');

    it('new install: saves encrypted token, decrypts back to token returned by Slack', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue(null);

      const result = await service.completeInstall('code123', goodState());

      expect(result).toEqual({ slackTeamId: 'T123', slackTeamName: 'Test WS' });
      const saved = tx.slackIntegration.create.mock.calls[0][0].data;
      expect(saved.tenantId).toBe('t1');
      expect(saved.slackTeamId).toBe('T123');
      expect(saved.accessToken).not.toContain('xoxb-secret-token');
      expect(crypto.decrypt(saved.accessToken)).toBe('xoxb-secret-token');
      expect(api.exchangeCode).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'code123', clientId: 'cid' }),
      );
    });

    it('invalid or forged state -> SLACK_STATE_INVALID, does not call Slack', async () => {
      const err: any = await service
        .completeInstall('c', 'invalid-state')
        .catch((e: unknown) => e);
      expect(err.code).toBe(ErrorCode.SLACK_STATE_INVALID);
      expect(api.exchangeCode).not.toHaveBeenCalled();
    });

    it('state signed with different key -> SLACK_STATE_INVALID', async () => {
      const err: any = await service
        .completeInstall('c', signSlackState('t1', 'unknown-key'))
        .catch((e: unknown) => e);
      expect(err.code).toBe(ErrorCode.SLACK_STATE_INVALID);
    });

    it('Slack returns ok=false -> SLACK_OAUTH_FAILED with reason, does not save anything', async () => {
      api.exchangeCode.mockResolvedValue({ ok: false, error: 'invalid_code' });
      const err: any = await service
        .completeInstall('c', goodState())
        .catch((e: unknown) => e);
      expect(err.code).toBe(ErrorCode.SLACK_OAUTH_FAILED);
      expect(err.message).toContain('invalid_code');
      expect(tx.slackIntegration.create).not.toHaveBeenCalled();
    });

    it('network error when calling Slack -> SLACK_OAUTH_FAILED', async () => {
      api.exchangeCode.mockRejectedValue(new Error('ECONNRESET'));
      const err: any = await service
        .completeInstall('c', goodState())
        .catch((e: unknown) => e);
      expect(err.code).toBe(ErrorCode.SLACK_OAUTH_FAILED);
    });

    it('workspace already connected to another tenant -> 409 SLACK_WORKSPACE_TAKEN, does not save', async () => {
      system.slackIntegration.findUnique.mockResolvedValue({
        tenantId: 'other-tenant',
      });
      const err: any = await service
        .completeInstall('c', goodState())
        .catch((e: unknown) => e);
      expect(err.code).toBe(ErrorCode.SLACK_WORKSPACE_TAKEN);
      expect(tx.slackIntegration.create).not.toHaveBeenCalled();
      expect(tx.slackIntegration.update).not.toHaveBeenCalled();
    });

    it('reinstall in same workspace: updates token, preserves channel mappings', async () => {
      system.slackIntegration.findUnique.mockResolvedValue({ tenantId: 't1' });
      tx.slackIntegration.findUnique.mockResolvedValue({
        id: 'si1',
        slackTeamId: 'T123',
      });

      await service.completeInstall('c', goodState());

      expect(tx.slackChannelMapping.deleteMany).not.toHaveBeenCalled();
      expect(tx.slackIntegration.update).toHaveBeenCalledTimes(1);
      expect(tx.slackIntegration.create).not.toHaveBeenCalled();
    });

    it('reinstall to different workspace: removes old mappings and updates', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue({
        id: 'si1',
        slackTeamId: 'T-old',
      });

      await service.completeInstall('c', goodState());

      expect(tx.slackChannelMapping.deleteMany).toHaveBeenCalledWith({
        where: { slackIntegrationId: 'si1' },
      });
      expect(
        tx.slackIntegration.update.mock.calls[0]![0].data.slackTeamId,
      ).toBe('T123');
    });
  });

  describe('getIntegration', () => {
    it('not connected returns connected: false', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue(null);
      expect(await service.getIntegration(caller)).toEqual({
        connected: false,
      });
    });

    it('connected returns teamId and timestamp, without accessToken', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue({
        slackTeamId: 'T123',
        createdAt: new Date('2026-10-17T00:00:00Z'),
      });
      const result = await service.getIntegration(caller);
      expect(result).toEqual({
        connected: true,
        slackTeamId: 'T123',
        connectedAt: '2026-10-17T00:00:00.000Z',
      });
      expect(JSON.stringify(result)).not.toContain('accessToken');
      expect(
        tx.slackIntegration.findUnique.mock.calls[0][0].select,
      ).not.toHaveProperty('accessToken');
    });
  });

  describe('disconnect', () => {
    it('removes from DB and revokes decrypted token on Slack', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue({
        id: 'si1',
        slackTeamId: 'T123',
        accessToken: crypto.encrypt('xoxb-secret-token'),
      });

      expect(await service.disconnect(caller)).toEqual({ connected: false });

      expect(tx.slackIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'si1' },
      });
      expect(api.revokeToken).toHaveBeenCalledWith('xoxb-secret-token');
    });

    it('not connected -> 404 SLACK_NOT_CONNECTED', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue(null);
      const err: any = await service
        .disconnect(caller)
        .catch((e: unknown) => e);
      expect(err.code).toBe(ErrorCode.SLACK_NOT_CONNECTED);
    });

    it('Slack token revocation failure is still considered a successful disconnect', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue({
        id: 'si1',
        slackTeamId: 'T123',
        accessToken: crypto.encrypt('xoxb-secret-token'),
      });
      api.revokeToken.mockRejectedValue(new Error('network down'));

      await expect(service.disconnect(caller)).resolves.toEqual({
        connected: false,
      });
      expect(tx.slackIntegration.delete).toHaveBeenCalled();
    });
  });
});
