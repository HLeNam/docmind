import { describe, expect, it, vi } from 'vitest';
import { DocumentsService } from '../src/documents/documents.service.js';

const CALLER = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'ADMIN',
} as any;

function build(
  opts: { document?: any; jobs?: any[]; getJobsThrows?: boolean } = {},
) {
  const tx = {
    document: {
      findUnique: vi.fn(async () =>
        opts.document === undefined
          ? { id: 'd1', collectionId: 'c1', fileUrl: 'k' }
          : opts.document,
      ),
      delete: vi.fn(async () => ({})),
    },
  };
  const prisma = {
    runInTenantContext: vi.fn(
      async (_t: string, fn: (tx: any) => Promise<any>) => fn(tx),
    ),
  };
  const storage = { deleteObject: vi.fn(async () => undefined) };
  const collections = {
    assertCollectionAccessible: vi.fn(async () => undefined),
  };
  const queue = {
    getJobs: vi.fn(async (..._a: any[]) => {
      if (opts.getJobsThrows) throw new Error('redis down');
      return opts.jobs ?? [];
    }),
  };
  const svc = new DocumentsService(
    prisma as any,
    storage as any,
    collections as any,
    queue as any,
  );
  return { svc, tx, storage, queue };
}

const job = (documentId: string, remove = vi.fn(async () => undefined)) => ({
  data: { documentId },
  remove,
});

describe('DocumentsService.remove — job cancellation', () => {
  it('deletes document and removes only waiting/delayed jobs belonging to that document', async () => {
    const mine1 = job('d1');
    const mine2 = job('d1');
    const other = job('d2');
    const { svc, tx, queue } = build({ jobs: [mine1, other, mine2] });

    const res = await svc.remove(CALLER, 'd1');

    expect(res).toEqual({ id: 'd1', deleted: true });
    expect(tx.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    expect(queue.getJobs).toHaveBeenCalledWith(['waiting', 'delayed'], 0, 999);
    expect(mine1.remove).toHaveBeenCalled();
    expect(mine2.remove).toHaveBeenCalled();
    expect(other.remove).not.toHaveBeenCalled();
  });

  it('ignores removal error when job already transitioned to active and succeeds deletion', async () => {
    const locked = job(
      'd1',
      vi.fn(async () => {
        throw new Error('job is locked');
      }),
    );
    const { svc } = build({ jobs: [locked] });
    await expect(svc.remove(CALLER, 'd1')).resolves.toEqual({
      id: 'd1',
      deleted: true,
    });
  });

  it('does not fail deletion when Redis or BullMQ throws', async () => {
    const { svc } = build({ getJobsThrows: true });
    await expect(svc.remove(CALLER, 'd1')).resolves.toEqual({
      id: 'd1',
      deleted: true,
    });
  });

  it('throws NotFoundAppException when document does not exist and does not access queue', async () => {
    const { svc, queue } = build({ document: null });
    await expect(svc.remove(CALLER, 'dx')).rejects.toThrow(
      'Document not found',
    );
    expect(queue.getJobs).not.toHaveBeenCalled();
  });
});
