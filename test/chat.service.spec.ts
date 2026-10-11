// test/chat.service.spec.ts
//
// Mock PrismaService.runInTenantContext (chạy thẳng callback với 1 tx giả), RetrievalService.search,
// và LlmProvider.streamChat (async generator giả) — không gọi DB/API thật. Test 3 method riêng biệt
// đúng theo ranh giới đã thiết kế: prepare() (có thể throw), streamAnswer() (chỉ delegate), và
// saveAssistantMessage() (lưu kết quả).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from '../src/chat/chat.service.js';
import type { AccessTokenPayload } from '../src/auth/auth.service.js';

const CALLER: AccessTokenPayload = {
  identityId: 'identity-1',
  tenantId: 'tenant-1',
  membershipId: 'member-1',
  role: 'MEMBER',
};

function buildService(overrides?: {
  conversationFindUnique?: unknown;
  messageFindMany?: unknown[];
  retrievedChunks?: unknown[];
}) {
  const tx = {
    conversation: {
      create: vi
        .fn()
        .mockResolvedValue({
          id: 'conv-new',
          tenantId: 'tenant-1',
          membershipId: 'member-1',
        }),
      findUnique: vi
        .fn()
        .mockResolvedValue(
          overrides?.conversationFindUnique !== undefined
            ? overrides.conversationFindUnique
            : { id: 'conv-1', tenantId: 'tenant-1', membershipId: 'member-1' },
        ),
    },
    message: {
      findMany: vi.fn().mockResolvedValue(overrides?.messageFindMany ?? []),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'msg-new', ...data }),
        ),
    },
  };
  const prisma = {
    runInTenantContext: vi.fn(
      (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
    ),
  };
  const retrievalService = {
    search: vi
      .fn()
      .mockResolvedValue(
        overrides?.retrievedChunks ?? [
          {
            id: 'chunk-1',
            documentId: 'doc-1',
            content: 'nội dung A',
            chunkIndex: 0,
            filename: 'a.pdf',
            score: 0.5,
          },
        ],
      ),
  };
  async function* fakeStream() {
    yield 'Xin';
    yield ' chào';
  }
  const llm = { streamChat: vi.fn().mockReturnValue(fakeStream()) };

  const service = new ChatService(
    prisma as never,
    retrievalService as never,
    llm as never,
  );
  return { service, prisma, tx, retrievalService, llm };
}

describe('ChatService.prepare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new Conversation bound to caller tenantId and membershipId when conversationId is not provided', async () => {
    const { service, tx } = buildService();

    const result = await service.prepare(CALLER, {
      content: 'câu hỏi',
      topK: 5,
    });

    expect(tx.conversation.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', membershipId: 'member-1' },
    });
    expect(result.conversationId).toBe('conv-new');
  });

  it('reuses existing conversation and loads history when valid conversationId belonging to caller is provided', async () => {
    const { service, tx, retrievalService } = buildService({
      // DB trả về DESC (tin mới nhất trước), prepare() sẽ reverse lại thành thứ tự thời gian
      messageFindMany: [
        { role: 'ASSISTANT', content: 'trả lời trước' },
        { role: 'USER', content: 'câu trước' },
      ],
    });

    const result = await service.prepare(CALLER, {
      conversationId: 'conv-1',
      content: 'câu mới',
      topK: 5,
    });

    expect(tx.conversation.create).not.toHaveBeenCalled();
    expect(retrievalService.search).toHaveBeenCalledWith(CALLER, {
      query: 'câu mới',
      collectionId: undefined,
      topK: 5,
    });
    expect(result.messages).toEqual([
      { role: 'user', content: 'câu trước' },
      { role: 'assistant', content: 'trả lời trước' },
      { role: 'user', content: 'câu mới' },
    ]);
  });

  it('throws NotFoundAppException when conversationId does not exist', async () => {
    const { service } = buildService({ conversationFindUnique: null });

    await expect(
      service.prepare(CALLER, {
        conversationId: 'conv-missing',
        content: 'x',
        topK: 5,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('throws NotFoundAppException when conversationId belongs to another membership', async () => {
    const { service } = buildService({
      conversationFindUnique: {
        id: 'conv-1',
        tenantId: 'tenant-1',
        membershipId: 'member-OTHER',
      },
    });

    await expect(
      service.prepare(CALLER, {
        conversationId: 'conv-1',
        content: 'x',
        topK: 5,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('builds citations in [1], [2]... order matching RetrievalService.search results', async () => {
    const { service } = buildService({
      retrievedChunks: [
        {
          id: 'c1',
          documentId: 'doc-1',
          content: 'A',
          chunkIndex: 0,
          filename: 'a.pdf',
          score: 0.9,
        },
        {
          id: 'c2',
          documentId: 'doc-2',
          content: 'B',
          chunkIndex: 1,
          filename: 'b.pdf',
          score: 0.8,
        },
      ],
    });

    const result = await service.prepare(CALLER, { content: 'x', topK: 5 });

    expect(result.citations).toEqual([
      {
        index: 1,
        documentId: 'doc-1',
        filename: 'a.pdf',
        chunkIndex: 0,
        score: 0.9,
      },
      {
        index: 2,
        documentId: 'doc-2',
        filename: 'b.pdf',
        chunkIndex: 1,
        score: 0.8,
      },
    ]);
    expect(result.systemPrompt).toContain('[1] (a.pdf) A');
    expect(result.systemPrompt).toContain('[2] (b.pdf) B');
  });

  it('returns valid systemPrompt with no context notice when no relevant chunks found', async () => {
    const { service } = buildService({ retrievedChunks: [] });

    const result = await service.prepare(CALLER, { content: 'x', topK: 5 });

    expect(result.citations).toEqual([]);
    expect(result.systemPrompt).toContain(
      'Không tìm thấy đoạn trích tài liệu nào liên quan',
    );
  });

  it('saves user message immediately in prepare() before streaming LLM', async () => {
    const { service, tx } = buildService();

    await service.prepare(CALLER, { content: 'câu hỏi user', topK: 5 });

    expect(tx.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: expect.any(String),
        role: 'USER',
        content: 'câu hỏi user',
      },
    });
  });
});

describe('ChatService.streamAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates directly to LlmProvider.streamChat with correct systemPrompt and messages', async () => {
    const { service, llm } = buildService();
    const prepared = {
      conversationId: 'conv-1',
      messages: [{ role: 'user' as const, content: 'hi' }],
      systemPrompt: 'system prompt',
      citations: [],
    };

    const out: string[] = [];
    for await (const delta of service.streamAnswer(prepared)) out.push(delta);

    expect(llm.streamChat).toHaveBeenCalledWith({
      systemPrompt: 'system prompt',
      messages: prepared.messages,
    });
    expect(out).toEqual(['Xin', ' chào']);
  });
});

describe('ChatService.saveAssistantMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves message with role ASSISTANT and citations for the corresponding conversationId', async () => {
    const { service, tx } = buildService();
    const prepared = {
      conversationId: 'conv-1',
      messages: [],
      systemPrompt: '',
      citations: [
        {
          index: 1,
          documentId: 'doc-1',
          filename: 'a.pdf',
          chunkIndex: 0,
          score: 0.5,
        },
      ],
    };

    await service.saveAssistantMessage(CALLER, prepared, 'câu trả lời đầy đủ');

    expect(tx.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        role: 'ASSISTANT',
        content: 'câu trả lời đầy đủ',
        citations: prepared.citations,
      },
    });
  });
});
