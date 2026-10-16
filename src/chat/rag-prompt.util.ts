// Dựng prompt RAG — dùng chung cho ChatService (chat có lưu hội thoại) và PublicQueryService
// (POST /v1/query, stateless) để 2 đường trả lời CÙNG 1 cách, sửa prompt ở 1 chỗ.
import type { RetrievedChunk } from '../retrieval/retrieval.service.js';

export function buildSystemPrompt(contextBlock: string): string {
  return `Bạn là trợ lý AI của DocMind, trả lời câu hỏi CHỈ dựa trên các đoạn trích tài liệu dưới đây. Nếu không tìm thấy thông tin liên quan trong ngữ cảnh, hãy nói rõ là không tìm thấy, KHÔNG tự bịa câu trả lời.

${contextBlock}

Khi trả lời, trích dẫn nguồn bằng ký hiệu [1], [2]... tương ứng với số thứ tự đoạn trích ở trên.`;
}

export function buildContextBlock(
  retrieved: Pick<RetrievedChunk, 'filename' | 'content'>[],
): string {
  if (retrieved.length === 0) {
    return '(Không tìm thấy đoạn trích tài liệu nào liên quan trong phạm vi bạn có quyền truy cập.)';
  }
  return retrieved
    .map((chunk, i) => `[${i + 1}] (${chunk.filename}) ${chunk.content}`)
    .join('\n\n');
}
