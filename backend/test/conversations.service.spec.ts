import { describe, expect, it, vi } from 'vitest';
import { ConversationsService } from '../src/chat/conversations.service.js';

const CALLER = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'MEMBER',
} as any;
const at = (s: string) => new Date(s);

function build(tx: Record<string, any>) {
  const prisma = {
    runInTenantContext: vi.fn(
      async (_t: string, fn: (tx: any) => Promise<any>) => fn(tx),
    ),
  };
  return { svc: new ConversationsService(prisma as any), prisma };
}

describe('ConversationsService.list', () => {
  const conv = (n: number, extra: any = {}) => ({
    id: `c${n}`,
    title: `T${n}`,
    createdAt: at(`2026-10-${10 + n}T00:00:00Z`),
    messages: [
      { content: 'tin cuối', createdAt: at(`2026-10-${10 + n}T01:00:00Z`) },
    ],
    _count: { messages: 4 },
    ...extra,
  });

  it('filters only by caller membership, newest first, fetches limit + 1 to detect next page', async () => {
    const findMany = vi.fn(async (..._a: any[]) => [
      conv(3),
      conv(2),
      conv(1),
    ]);
    const { svc, prisma } = build({ conversation: { findMany } });

    const res = await svc.list(CALLER, { limit: 2 });

    expect(prisma.runInTenantContext).toHaveBeenCalledWith(
      't1',
      expect.any(Function),
    );
    const args = findMany.mock.calls[0]![0] as any;
    expect(args.where).toEqual({ membershipId: 'm1' });
    expect(args.take).toBe(3);
    expect(args.cursor).toBeUndefined();
    expect(res.items.map((i) => i.id)).toEqual(['c3', 'c2']);
    expect(res.nextCursor).toBe('c2');
  });

  it('returns nextCursor null on last page, and passes cursor with skip 1 when provided', async () => {
    const findMany = vi.fn(async (..._a: any[]) => [conv(1)]);
    const { svc } = build({ conversation: { findMany } });

    const res = await svc.list(CALLER, { limit: 2, cursor: 'c2' });

    const args = findMany.mock.calls[0]![0] as any;
    expect(args.cursor).toEqual({ id: 'c2' });
    expect(args.skip).toBe(1);
    expect(res.nextCursor).toBeNull();
  });

  it('maps all fields correctly, sets lastMessageAt and preview to null when empty, and truncates long preview', async () => {
    const long = 'x'.repeat(300);
    const findMany = vi.fn(async (..._a: any[]) => [
      conv(2, {
        messages: [{ content: long, createdAt: at('2026-10-12T05:00:00Z') }],
      }),
      conv(1, { title: null, messages: [], _count: { messages: 0 } }),
    ]);
    const { svc } = build({ conversation: { findMany } });

    const { items } = await svc.list(CALLER, { limit: 20 });

    expect(items[0]!.lastMessageAt).toBe('2026-10-12T05:00:00.000Z');
    expect(Array.from(items[0]!.preview!)).toHaveLength(120);
    expect(items[0]!.messageCount).toBe(4);
    expect(items[1]).toMatchObject({
      title: null,
      lastMessageAt: null,
      preview: null,
      messageCount: 0,
    });
  });
});

describe('ConversationsService.rename', () => {
  it('renames conversation owned by caller', async () => {
    const update = vi.fn(async (a: any) => ({ id: a.where.id }));
    const { svc } = build({
      conversation: {
        findUnique: vi.fn(async () => ({ id: 'c1', membershipId: 'm1' })),
        update,
      },
    });
    expect(await svc.rename(CALLER, 'c1', { title: 'Tên mới' })).toEqual({
      id: 'c1',
      title: 'Tên mới',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { title: 'Tên mới' },
    });
  });

  it('throws 404 and does not update when conversation belongs to another member or does not exist', async () => {
    const update = vi.fn();
    const other = build({
      conversation: {
        findUnique: vi.fn(async () => ({
          id: 'c1',
          membershipId: 'ai-khac',
        })),
        update,
      },
    });
    await expect(
      other.svc.rename(CALLER, 'c1', { title: 'x' }),
    ).rejects.toThrow('Conversation not found');

    const missing = build({
      conversation: { findUnique: vi.fn(async () => null), update },
    });
    await expect(
      missing.svc.rename(CALLER, 'c9', { title: 'x' }),
    ).rejects.toThrow('Conversation not found');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('ConversationsService.remove', () => {
  it('deletes own conversation: deleteMany filters by caller id and membershipId', async () => {
    const deleteMany = vi.fn(async (..._a: any[]) => ({ count: 1 }));
    const { svc, prisma } = build({ conversation: { deleteMany } });

    expect(await svc.remove(CALLER, 'c1')).toEqual({ id: 'c1', deleted: true });
    expect(prisma.runInTenantContext).toHaveBeenCalledWith(
      't1',
      expect.any(Function),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'c1', membershipId: 'm1' },
    });
  });

  it('throws 404 when no row deleted (belongs to other member, non-existent, or already deleted)', async () => {
    const { svc } = build({
      conversation: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    });
    await expect(svc.remove(CALLER, 'c1')).rejects.toThrow(
      'Conversation not found',
    );
  });
});

describe('ConversationsService.listMessages', () => {
  const msg = (n: number) => ({
    id: `m${n}`,
    role: n % 2 ? 'USER' : 'ASSISTANT',
    content: `nội dung ${n}`,
    citations: n % 2 ? null : [{ index: 1 }],
    createdAt: at(`2026-10-18T0${n}:00:00Z`),
  });

  it('returns messages in chronological order (oldest to newest) with nextBefore as oldest message id', async () => {
    // DB returns DESC: m4, m3, m2 (limit 2 + 1 extra row)
    const findMany = vi.fn(async (..._a: any[]) => [msg(4), msg(3), msg(2)]);
    const { svc } = build({
      conversation: {
        findUnique: vi.fn(async () => ({ id: 'c1', membershipId: 'm1' })),
      },
      message: { findMany },
    });

    const res = await svc.listMessages(CALLER, 'c1', { limit: 2 });

    expect((findMany.mock.calls[0]![0] as any).where).toEqual({
      conversationId: 'c1',
    });
    expect(res.items.map((m) => m.id)).toEqual(['m3', 'm4']);
    expect(res.nextBefore).toBe('m3');
    expect(res.items[1]!.citations).toEqual([{ index: 1 }]);
    expect(res.items[0]!.citations).toBeNull();
  });

  it('returns nextBefore null when no older messages, and uses cursor with skip 1 for before query', async () => {
    const findMany = vi.fn(async (..._a: any[]) => [msg(1)]);
    const { svc } = build({
      conversation: {
        findUnique: vi.fn(async () => ({ id: 'c1', membershipId: 'm1' })),
      },
      message: { findMany },
    });
    const res = await svc.listMessages(CALLER, 'c1', {
      limit: 50,
      before: 'm2',
    });
    const args = findMany.mock.calls[0]![0] as any;
    expect(args.cursor).toEqual({ id: 'm2' });
    expect(args.skip).toBe(1);
    expect(res.nextBefore).toBeNull();
  });

  it('throws 404 and does not read messages when conversation belongs to another member', async () => {
    const findMany = vi.fn();
    const { svc } = build({
      conversation: {
        findUnique: vi.fn(async () => ({
          id: 'c1',
          membershipId: 'ai-khac',
        })),
      },
      message: { findMany },
    });
    await expect(svc.listMessages(CALLER, 'c1', { limit: 50 })).rejects.toThrow(
      'Conversation not found',
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
