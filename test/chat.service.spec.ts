// Mock PrismaService.runInTenantContext (chạy thẳng callback với 1 tx giả), RetrievalService.search,
// và LlmProvider.streamChat (async generator giả) — không gọi DB/API thật. Test 3 method riêng biệt
// đúng theo ranh giới đã thiết kế: prepare() (có thể throw), streamAnswer() (chỉ delegate), và
// saveAssistantMessage() (lưu kết quả).
import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../src/chat/chat.service.js';
import type { AccessTokenPayload } from '../src/auth/auth.service.js';
import { buildSummarySection } from '../src/chat/chat.service.js';

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
      create: vi.fn().mockResolvedValue({
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
    search: vi.fn().mockResolvedValue(
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

  const usage = { record: vi.fn() };
  const summarizer = { maybeSummarize: vi.fn().mockResolvedValue(undefined) };
  const service = new ChatService(
    prisma as never,
    retrievalService as never,
    llm as never,
    usage as never,
    summarizer as never,
  );
  return { service, prisma, tx, retrievalService, llm, usage, summarizer };
}

describe('ChatService.prepare', () => {
  it('creates a new Conversation bound to caller tenantId and membershipId when conversationId is not provided', async () => {
    const { service, tx } = buildService();

    const result = await service.prepare(CALLER, {
      content: 'câu hỏi',
      topK: 5,
    });

    expect(tx.conversation.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        membershipId: 'member-1',
        title: 'câu hỏi',
      },
    });
    expect(result.conversationId).toBe('conv-new');
  });

  it('reuses existing conversation and loads history when valid conversationId belonging to caller is provided', async () => {
    const { service, tx, retrievalService } = buildService({
      // DB returns DESC (newest first); prepare() will reverse to chronological order
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
          pageNumber: 3,
          headingContext: null,
          score: 0.9,
        },
        {
          id: 'c2',
          documentId: 'doc-2',
          content: 'B',
          chunkIndex: 1,
          filename: 'b.docx',
          pageNumber: null,
          headingContext: '## Giới thiệu SCM',
          score: 0.8,
        },
      ],
    });

    const result = await service.prepare(CALLER, { content: 'x', topK: 5 });

    // pageNumber (PDF) và headingContext (DOCX/Markdown) phải đi hết vào citation để FE "nhảy đúng chỗ".
    expect(result.citations).toEqual([
      {
        index: 1,
        documentId: 'doc-1',
        filename: 'a.pdf',
        chunkIndex: 0,
        pageNumber: 3,
        headingContext: null,
        score: 0.9,
      },
      {
        index: 2,
        documentId: 'doc-2',
        filename: 'b.docx',
        chunkIndex: 1,
        pageNumber: null,
        headingContext: '## Giới thiệu SCM',
        score: 0.8,
      },
    ]);
    expect(result.systemPrompt).toContain('[1] (a.pdf) A');
    expect(result.systemPrompt).toContain('[2] (b.docx) B');
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
  it('delegates directly to LlmProvider.streamChat with correct systemPrompt and messages', async () => {
    const { service, llm } = buildService();
    const prepared = {
      tenantId: 'tenant-1',
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
      onUsage: expect.any(Function),
    });
    expect(out).toEqual(['Xin', ' chào']);
  });

  it('records GENERATION usage for caller tenant when provider reports tokens via onUsage', async () => {
    const { service, llm, usage } = buildService();
    const prepared = {
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      messages: [{ role: 'user' as const, content: 'hi' }],
      systemPrompt: 's',
      citations: [],
    };
    llm.streamChat.mockImplementation(async function* (params: any) {
      yield 'ok';
      params.onUsage({ inputTokens: 120, outputTokens: 30 });
    });

    for await (const _ of service.streamAnswer(prepared)) void _;

    expect(usage.record).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      type: 'GENERATION',
      inputTokens: 120,
      outputTokens: 30,
    });
  });
});

describe('ChatService.saveAssistantMessage', () => {
  it('saves message with role ASSISTANT and citations for the corresponding conversationId', async () => {
    const { service, tx } = buildService();
    const prepared = {
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      messages: [],
      systemPrompt: '',
      citations: [
        {
          index: 1,
          documentId: 'doc-1',
          filename: 'a.pdf',
          chunkIndex: 0,
          pageNumber: 2,
          headingContext: null,
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

  it('triggers background summarization for the conversation without blocking or failing save', async () => {
    const { service, summarizer } = buildService();
    const prepared = {
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      messages: [],
      systemPrompt: '',
      citations: [],
    };

    const saved = await service.saveAssistantMessage(
      CALLER,
      prepared as never,
      'trả lời',
    );

    expect(saved).toMatchObject({ id: 'msg-new', role: 'ASSISTANT' });
    expect(summarizer.maybeSummarize).toHaveBeenCalledWith(CALLER, 'conv-1');
  });
});

describe('ChatService.prepare — conversation summary', () => {
  it('attaches summary to system prompt as data when conversation has summary', async () => {
    const { service } = buildService({
      conversationFindUnique: {
        id: 'conv-1',
        tenantId: 'tenant-1',
        membershipId: 'member-1',
        summary: 'Người dùng đang hỏi về Unsupervised learning.',
      },
    });

    const result = await service.prepare(CALLER, {
      conversationId: 'conv-1',
      content: 'còn loại hai?',
      topK: 5,
    });

    expect(result.systemPrompt).toContain('TÓM TẮT PHẦN ĐẦU HỘI THOẠI');
    expect(result.systemPrompt).toContain(
      'Người dùng đang hỏi về Unsupervised learning.',
    );
    expect(result.systemPrompt).toContain('KHÔNG phải chỉ dẫn');
  });

  it('leaves system prompt unchanged when conversation has no summary', async () => {
    const { service } = buildService();
    const result = await service.prepare(CALLER, {
      conversationId: 'conv-1',
      content: 'x',
      topK: 5,
    });
    expect(result.systemPrompt).not.toContain('TÓM TẮT PHẦN ĐẦU HỘI THOẠI');
  });
});

describe('buildSummarySection', () => {
  it('returns empty string for null, undefined, or whitespace-only summary', () => {
    expect(buildSummarySection(null)).toBe('');
    expect(buildSummarySection(undefined)).toBe('');
    expect(buildSummarySection('  \n ')).toBe('');
  });
});
