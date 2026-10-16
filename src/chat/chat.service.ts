// Tách làm 3 method riêng biệt (prepare -> streamAnswer -> saveAssistantMessage) thay vì gộp thành
// 1 async generator duy nhất — lý do nằm ở ranh giới HTTP: SSE bắt buộc set header "200 OK,
// text/event-stream" NGAY TRƯỚC khi ghi byte đầu tiên, và KHÔNG THỂ đổi status code sau đó nữa. Mọi
// lỗi nghiệp vụ "bình thường" (conversation không tồn tại/không thuộc về caller...) phải được validate
// XONG và throw TRƯỚC khi controller set header đó, để GlobalExceptionFilter vẫn xử lý được, trả
// đúng JSON error + status code chuẩn như mọi route khác. Lỗi xảy ra SAU khi đã bắt đầu stream
// (network đứt giữa chừng khi gọi LLM...) thì không còn cách nào khác ngoài emit 1 SSE event riêng
// báo lỗi — 2 loại lỗi này cần 2 cách xử lý khác hẳn nhau, nên tách method rõ ràng theo đúng ranh
// giới đó, không gộp chung cho "gọn".
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../prisma/prisma-client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RetrievalService } from '../retrieval/retrieval.service.js';
import { LLM_PROVIDER_TOKEN } from './llm/llm-provider.interface.js';
import type { LlmProvider, ChatMessage } from './llm/llm-provider.interface.js';
import { NotFoundAppException } from '../common/exceptions/app.exception.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { SendMessageDto } from './dtos/chat.dto.js';

// Số tin nhắn GẦN NHẤT lấy làm ngữ cảnh hội thoại — hội thoại dài vô hạn mà nhét hết vào mỗi lần
// gọi LLM sẽ phình prompt không giới hạn (tốn token, chậm, có thể vượt context window). Đánh đổi
// chấp nhận được cho MVP: hội thoại rất dài sẽ "quên" phần đầu — xem mục "Chưa làm" trong notes.
const HISTORY_LIMIT = 10;
const DEFAULT_TOP_K = 5;

function buildSystemPrompt(contextBlock: string): string {
  return `Bạn là trợ lý AI của DocMind, trả lời câu hỏi CHỈ dựa trên các đoạn trích tài liệu dưới đây. Nếu không tìm thấy thông tin liên quan trong ngữ cảnh, hãy nói rõ là không tìm thấy, KHÔNG tự bịa câu trả lời.

${contextBlock}

Khi trả lời, trích dẫn nguồn bằng ký hiệu [1], [2]... tương ứng với số thứ tự đoạn trích ở trên.`;
}

export interface ChatCitation {
  index: number; // thứ tự [1],[2]... dùng trong systemPrompt — khớp với citations lưu vào Message
  documentId: string;
  filename: string;
  chunkIndex: number;
  // Vị trí trong tài liệu để FE "nhảy đúng chỗ": pageNumber có với PDF (tách được trang), headingContext
  // có với DOCX/Markdown có heading. Cả hai có thể null (vd txt/csv, hoặc PDF/DOCX không tách được cấu
  // trúc) — FE cần xử lý trường hợp null, chỉ hiển thị tên file như trước.
  pageNumber: number | null;
  headingContext: string | null;
  score: number;
}

export interface PreparedChat {
  conversationId: string;
  messages: ChatMessage[]; // history + user message mới, sẵn sàng gửi thẳng cho LlmProvider
  systemPrompt: string;
  citations: ChatCitation[];
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
    // Inject qua token (xem CHAT_MODULE_NOTES.md) — đổi provider chỉ cần đổi env LLM_PROVIDER.
    @Inject(LLM_PROVIDER_TOKEN) private readonly llm: LlmProvider,
  ) {}

  /**
   * Toàn bộ phần CÓ THỂ throw lỗi nghiệp vụ bình thường. Controller PHẢI await xong hàm này trước
   * khi set header SSE.
   */
  async prepare(
    caller: AccessTokenPayload,
    dto: SendMessageDto,
  ): Promise<PreparedChat> {
    const conversation = await this.resolveConversation(
      caller,
      dto.conversationId,
    );

    const recentHistory = await this.prisma.runInTenantContext(
      caller.tenantId,
      (tx) =>
        tx.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: HISTORY_LIMIT,
        }),
    );
    recentHistory.reverse(); // query lấy DESC (N tin MỚI NHẤT) -> đảo lại ASC cho đúng thứ tự thời gian thật

    const retrieved = await this.retrievalService.search(caller, {
      query: dto.content,
      collectionId: dto.collectionId,
      topK: dto.topK ?? DEFAULT_TOP_K,
    });

    const citations: ChatCitation[] = retrieved.map((chunk, i) => ({
      index: i + 1,
      documentId: chunk.documentId,
      filename: chunk.filename,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      headingContext: chunk.headingContext,
      score: chunk.score,
    }));

    const contextBlock =
      retrieved.length > 0
        ? retrieved
            .map(
              (chunk, i) => `[${i + 1}] (${chunk.filename}) ${chunk.content}`,
            )
            .join('\n\n')
        : '(Không tìm thấy đoạn trích tài liệu nào liên quan trong phạm vi bạn có quyền truy cập.)';

    // Lưu user message NGAY, TRƯỚC khi gọi LLM — nếu LLM lỗi/timeout giữa chừng ở bước streamAnswer()
    // (method khác, chạy sau), câu hỏi của user vẫn còn trong lịch sử hội thoại, không bị mất.
    await this.prisma.runInTenantContext(caller.tenantId, (tx) =>
      tx.message.create({
        data: {
          conversationId: conversation.id,
          role: 'USER',
          content: dto.content,
        },
      }),
    );

    const messages: ChatMessage[] = [
      ...recentHistory.map((m): ChatMessage => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: dto.content },
    ];

    return {
      conversationId: conversation.id,
      messages,
      systemPrompt: buildSystemPrompt(contextBlock),
      citations,
    };
  }

  /**
   * Phần CÓ THỂ lỗi giữa chừng (network/provider timeout, rate limit...) — controller đã commit
   * response SSE (header đã gửi) trước khi gọi hàm này, nên lỗi ở đây phải được controller bắt bằng
   * try/catch quanh vòng lặp `for await`, KHÔNG để nó tự throw làm crash response đang dở.
   */
  async *streamAnswer(prepared: PreparedChat): AsyncGenerator<string> {
    yield* this.llm.streamChat({
      systemPrompt: prepared.systemPrompt,
      messages: prepared.messages,
    });
  }

  /**
   * Gọi SAU KHI streamAnswer() chạy xong TRỌN VẸN (controller tự quyết định có gọi hay không — nếu
   * streamAnswer() throw giữa chừng, controller KHÔNG gọi hàm này, tránh lưu câu trả lời dang dở vào
   * lịch sử, gây hiểu lầm cho lần hỏi tiếp theo).
   */
  async saveAssistantMessage(
    caller: AccessTokenPayload,
    prepared: PreparedChat,
    fullAnswer: string,
  ) {
    return this.prisma.runInTenantContext(caller.tenantId, (tx) =>
      tx.message.create({
        data: {
          conversationId: prepared.conversationId,
          role: 'ASSISTANT',
          content: fullAnswer,
          // citations: Json? trong schema — Prisma yêu cầu đúng kiểu Prisma.InputJsonValue (có index
          // signature) cho field Json, mà interface ChatCitation[] tự khai (dù cấu trúc y hệt, chỉ
          // string/number phẳng) KHÔNG tự thoả mãn structurally vì TS không suy ra index signature từ
          // interface thường. Ép kiểu tường minh qua `unknown` trước — AN TOÀN ở đây vì ChatCitation
          // chỉ gồm field string/number, không có Date/undefined/function (những thứ JSON không
          // serialize được), khác với ép kiểu "any" bừa bãi.
          citations: prepared.citations as unknown as Prisma.InputJsonValue,
        },
      }),
    );
  }

  private async resolveConversation(
    caller: AccessTokenPayload,
    conversationId?: string,
  ) {
    if (!conversationId) {
      return this.prisma.runInTenantContext(caller.tenantId, (tx) =>
        tx.conversation.create({
          data: {
            tenantId: caller.tenantId,
            membershipId: caller.membershipId,
          },
        }),
      );
    }

    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
      });
      // Conversation gắn với ĐÚNG membership đã tạo ra nó — khác Collection (chia sẻ trong tenant
      // qua CollectionAccess), hội thoại chat là RIÊNG TƯ của từng thành viên, kể cả với OWNER/ADMIN
      // (không có khái niệm "OWNER xem được chat của MEMBER khác" ở MVP này).
      if (!conversation || conversation.membershipId !== caller.membershipId) {
        throw new NotFoundAppException('Conversation not found');
      }
      return conversation;
    });
  }
}
