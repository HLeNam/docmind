// WebSocket gateway báo tiến độ xử lý tài liệu realtime (document.progress event) cho FE, scoped
// theo room `tenant:<tenantId>` để tenant A không thấy tiến độ của tenant B.
//
// ⚠️ LỖ HỔNG BẢO MẬT ĐÃ BIẾT (ghi lại từ doc Phase 2 gốc, CHƯA xử lý — chấp nhận tạm thời):
// - Không có JWT auth lúc handshake WebSocket (`handleConnection` không verify token).
// - Việc join room `tenant:<tenantId>` tin tưởng HOÀN TOÀN giá trị tenantId do client tự gửi lên
//   (qua `@SubscribeMessage('join')`) — một client gửi sai/giả tenantId vẫn join được room đó và
//   nghe được tiến độ xử lý tài liệu của tenant khác.
// - Lý do tạm chấp nhận ở Phase 2 MVP: CHƯA có frontend thật kết nối (chỉ dùng để demo/test local
//   qua Postman/socket.io-client thủ công), nên chưa có đường tấn công thực tế từ người dùng thật.
// - BẮT BUỘC phải sửa trước khi có FE/production: xác thực JWT ngay trong `handleConnection`
//   (đọc token từ `client.handshake.auth.token` hoặc query, verify, lưu `tenantId` đã xác thực vào
//   `client.data`), rồi dùng `client.data.tenantId` để join room — KHÔNG dùng giá trị client tự gửi.
import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

export type DocumentProcessingPhase =
  | 'extracting'
  | 'chunking'
  // PDF scan ảnh, text extract ra quá ít -> đang chạy OCR fallback (ocr.util.ts) — bước này CÓ THỂ
  // CHẬM hơn đáng kể so với các phase khác (OCR từng trang tuần tự), nên tách phase riêng thay vì
  // gộp chung 'chunking'/'embedding' để FE (sau này) có thể hiển thị thông báo phù hợp
  // ("đang nhận dạng chữ trong ảnh scan...") thay vì để progress bar đứng yên khó hiểu.
  | 'ocr'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'failed';

export interface DocumentProgressPayload {
  documentId: string;
  percent: number;
  phase: DocumentProcessingPhase;
  message?: string;
}

function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*' }, // MVP local demo — siết lại origin cụ thể khi có FE thật/production.
})
export class ProgressGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ProgressGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  handleConnection(client: Socket): void {
    // CHƯA xác thực JWT ở đây — xem cảnh báo bảo mật ở đầu file. Chỉ log để dễ debug lúc demo local.
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // Client tự gửi tenantId để join room — KHÔNG được coi là đã xác thực, chỉ phù hợp cho demo local.
  @SubscribeMessage('join')
  handleJoin(client: Socket, payload: { tenantId: string }): void {
    if (!payload?.tenantId) {
      return;
    }
    void client.join(tenantRoom(payload.tenantId));
    this.logger.debug(
      `Client ${client.id} joined room ${tenantRoom(payload.tenantId)}`,
    );
  }

  @SubscribeMessage('leave')
  handleLeave(client: Socket, payload: { tenantId: string }): void {
    if (!payload?.tenantId) {
      return;
    }
    void client.leave(tenantRoom(payload.tenantId));
  }

  /**
   * Gọi từ DocumentProcessingProcessor ở mỗi bước (extract -> chunk -> embed -> indexing xong).
   * Emit event `document.progress` chỉ tới client đã join đúng room của tenant đó.
   */
  emitProgress(tenantId: string, payload: DocumentProgressPayload): void {
    this.server.to(tenantRoom(tenantId)).emit('document.progress', payload);
  }
}
