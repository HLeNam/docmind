// Mock PrismaService.runInTenantContext (runs callback with mock tx), RetrievalService.search,
// and LlmProvider.streamChat (mock async generator) — does not call real DB/API. Tests 3 distinct
// methods based on design boundaries: prepare() (can throw), streamAnswer() (delegates), and
// saveAssistantMessage() (persists result).
import { describe, expect, it, vi } from 'vitest';
import {
  ChatService,
  buildSummarySection,
  type PreparedChat,
} from '../src/chat/chat.service.js';
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
  // Default preserves question (as when there is no history) so standard tests remain unchanged.
  const condenser = {
    condense: vi.fn(async (_history: unknown, question: string) => question),
  };
  const service = new ChatService(
    prisma as never,
    retrievalService as never,
    llm as never,
    usage as never,
    summarizer as never,
    condenser as never,
  );
  return {
    service,
    prisma,
    tx,
    retrievalService,
    llm,
    usage,
    summarizer,
    condenser,
  };
}

describe('ChatService.prepare', () => {
  it('creates a new Conversation with caller tenantId and membershipId when conversationId is omitted', async () => {
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

  it('reuses existing conversation and loads history when valid conversationId is provided', async () => {
    const { service, tx, retrievalService } = buildService({
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

  it('throws NotFoundAppException when conversation belongs to another membership', async () => {
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

    // pageNumber (PDF) and headingContext (DOCX/Markdown) are included in citation for UI deep linking.
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

  it('returns valid systemPrompt indicating no relevant context when chunks are empty', async () => {
    const { service } = buildService({ retrievedChunks: [] });

    const result = await service.prepare(CALLER, { content: 'x', topK: 5 });

    expect(result.citations).toEqual([]);
    expect(result.systemPrompt).toContain(
      'Không tìm thấy đoạn trích tài liệu nào liên quan',
    );
  });

  it('persists user message in prepare() before streaming LLM response', async () => {
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
    const prepared: PreparedChat = {
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      rewrittenQuery: null,
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

  it('records GENERATION usage for correct tenant when onUsage is reported without awaiting', async () => {
    const { service, llm, usage } = buildService();
    const prepared: PreparedChat = {
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      rewrittenQuery: null,
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
  it('persists ASSISTANT message with citations for correct conversationId', async () => {
    const { service, tx } = buildService();
    const prepared: PreparedChat = {
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      rewrittenQuery: null,
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

  it('triggers background summarization for the conversation without blocking', async () => {
    const { service, summarizer } = buildService();
    const prepared: PreparedChat = {
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      rewrittenQuery: null,
      messages: [],
      systemPrompt: '',
      citations: [],
    };

    const saved = await service.saveAssistantMessage(
      CALLER,
      prepared,
      'trả lời',
    );

    expect(saved).toMatchObject({ id: 'msg-new', role: 'ASSISTANT' });
    expect(summarizer.maybeSummarize).toHaveBeenCalledWith(CALLER, 'conv-1');
  });
});

describe('ChatService.prepare — conversation summary', () => {
  it('attaches summary to system prompt as data when conversation already has a summary', async () => {
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

  it('leaves system prompt unchanged when summary does not exist', async () => {
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
  it('returns empty string for null, undefined, or whitespace', () => {
    expect(buildSummarySection(null)).toBe('');
    expect(buildSummarySection(undefined)).toBe('');
    expect(buildSummarySection('  \n ')).toBe('');
  });
});

describe('ChatService.prepare — question condensing', () => {
  it('searches documents using condensed query when history exists while preserving original question for LLM and database', async () => {
    const { service, condenser, retrievalService, tx } = buildService({
      messageFindMany: [
        { role: 'ASSISTANT', content: 'Supervised và Unsupervised.' },
        { role: 'USER', content: 'Có những loại ML nào?' },
      ],
    });
    condenser.condense.mockResolvedValueOnce('Unsupervised learning là gì?');

    const result = await service.prepare(CALLER, {
      conversationId: 'conv-1',
      content: 'còn loại hai?',
      topK: 5,
    });

    expect(condenser.condense).toHaveBeenCalledWith(
      [
        { role: 'user', content: 'Có những loại ML nào?' },
        { role: 'assistant', content: 'Supervised và Unsupervised.' },
      ],
      'còn loại hai?',
      'tenant-1',
    );
    expect(
      (retrievalService.search.mock.calls[0] as unknown[])[1],
    ).toMatchObject({ query: 'Unsupervised learning là gì?' });
    expect(result.rewrittenQuery).toBe('Unsupervised learning là gì?');
    expect(result.messages[result.messages.length - 1]).toEqual({
      role: 'user',
      content: 'còn loại hai?',
    });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        role: 'USER',
        content: 'còn loại hai?',
      },
    });
  });

  it('sets rewrittenQuery to null when query is unchanged', async () => {
    const { service } = buildService();
    const result = await service.prepare(CALLER, {
      content: 'ML là gì?',
      topK: 5,
    });
    expect(result.rewrittenQuery).toBeNull();
  });
});
