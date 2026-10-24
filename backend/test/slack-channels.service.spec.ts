import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlackChannelsService } from '../src/slack/slack-channels.service.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

const caller = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'OWNER',
};

describe('SlackChannelsService', () => {
  let tx: any;
  let service: SlackChannelsService;

  beforeEach(() => {
    tx = {
      slackIntegration: { findUnique: vi.fn(async () => ({ id: 'si1' })) },
      collection: {
        findUnique: vi.fn(async () => ({ id: 'c1', name: 'HR Docs' })),
      },
      slackChannelMapping: {
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(),
        upsert: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
    };
    const prisma: any = {
      runInTenantContext: vi.fn(
        async (_t: string, fn: (t: unknown) => unknown) => fn(tx),
      ),
    };
    service = new SlackChannelsService(prisma);
  });

  const codeOf = async (p: Promise<unknown>) =>
    ((await p.catch((e: unknown) => e)) as { code?: string }).code;

  describe('list', () => {
    it('not connected to Slack -> returns empty array without error', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue(null);
      expect(await service.list(caller)).toEqual([]);
      expect(tx.slackChannelMapping.findMany).not.toHaveBeenCalled();
    });

    it('returns channelId and collection name', async () => {
      tx.slackChannelMapping.findMany.mockResolvedValue([
        {
          slackChannelId: 'C0AAA1111',
          collectionId: 'c1',
          collection: { name: 'HR Docs' },
        },
      ]);
      expect(await service.list(caller)).toEqual([
        {
          channelId: 'C0AAA1111',
          collectionId: 'c1',
          collectionName: 'HR Docs',
        },
      ]);
    });
  });

  describe('upsert', () => {
    it('maps channel to collection, upserts by integration and channel', async () => {
      const result = await service.upsert(caller, 'C0AAA1111', 'c1');

      expect(result).toEqual({
        channelId: 'C0AAA1111',
        collectionId: 'c1',
        collectionName: 'HR Docs',
      });
      expect(tx.slackChannelMapping.upsert).toHaveBeenCalledWith({
        where: {
          slackIntegrationId_slackChannelId: {
            slackIntegrationId: 'si1',
            slackChannelId: 'C0AAA1111',
          },
        },
        create: {
          slackIntegrationId: 'si1',
          slackChannelId: 'C0AAA1111',
          collectionId: 'c1',
        },
        update: { collectionId: 'c1' },
      });
    });

    it.each(['', 'abc', 'D0AAA1111', 'C0aaa1111', 'C1', '../etc'])(
      'invalid channelId format %p -> 400',
      async (bad) => {
        expect(await codeOf(service.upsert(caller, bad, 'c1'))).toBe(
          ErrorCode.SLACK_CHANNEL_ID_INVALID,
        );
        expect(tx.slackChannelMapping.upsert).not.toHaveBeenCalled();
      },
    );

    it('not connected to Slack -> 404 SLACK_NOT_CONNECTED', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.upsert(caller, 'C0AAA1111', 'c1'))).toBe(
        ErrorCode.SLACK_NOT_CONNECTED,
      );
    });

    it('collection not found or belongs to another tenant (RLS returns null) -> 404, does not write', async () => {
      tx.collection.findUnique.mockResolvedValue(null);
      expect(
        await codeOf(service.upsert(caller, 'C0AAA1111', 'unknown-collection')),
      ).toBe(ErrorCode.COLLECTION_NOT_FOUND);
      expect(tx.slackChannelMapping.upsert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes existing mapping', async () => {
      tx.slackChannelMapping.findUnique.mockResolvedValue({ id: 'map1' });
      expect(await service.remove(caller, 'C0AAA1111')).toEqual({
        channelId: 'C0AAA1111',
        mapped: false,
      });
      expect(tx.slackChannelMapping.delete).toHaveBeenCalledWith({
        where: { id: 'map1' },
      });
    });

    it('channel not mapped -> 404 SLACK_CHANNEL_NOT_MAPPED', async () => {
      tx.slackChannelMapping.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.remove(caller, 'C0AAA1111'))).toBe(
        ErrorCode.SLACK_CHANNEL_NOT_MAPPED,
      );
    });

    it('not connected to Slack -> also 404 SLACK_CHANNEL_NOT_MAPPED', async () => {
      tx.slackIntegration.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.remove(caller, 'C0AAA1111'))).toBe(
        ErrorCode.SLACK_CHANNEL_NOT_MAPPED,
      );
    });
  });
});
