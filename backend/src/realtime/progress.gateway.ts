// WebSocket gateway báo tiến độ xử lý tài liệu realtime (document.progress event) cho FE, scoped
// theo room `tenant:<tenantId>` để tenant A không thấy tiến độ của tenant B.
//
// BẢO MẬT (đã xử lý ở nợ #2 Giai đoạn 2):
//  - Xác thực JWT access token NGAY lúc handshake (handleConnection). Token lấy từ `auth.token` của
//    socket.io-client (khuyến nghị) hoặc header `Authorization: Bearer ...`. Sai/thiếu/hết hạn -> báo
//    `auth_error` rồi ngắt kết nối, KHÔNG join room nào.
//  - Room lấy từ tenantId TRONG JWT đã verify, tự join lúc kết nối. Client không còn chọn được room:
//    event `join`/`leave` cũ bị bỏ, không có đường nào để nghe tiến độ của tenant khác.
//  - Access token sống 15 phút nên socket cũng bị ngắt đúng lúc token hết hạn (không để socket "sống mãi"
//    sau khi quyền đã bị thu hồi). FE nghe `disconnect` rồi kết nối lại bằng token mới (đã refresh).
//  - CORS vẫn '*': chấp nhận được vì xác thực bằng token trong handshake, không dùng cookie. Siết origin
//    khi deploy nếu muốn thêm 1 lớp.
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/auth.service.js';

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

/** Dữ liệu gắn vào socket sau khi xác thực (client.data). */
export interface AuthenticatedSocketData {
  tenantId: string;
  identityId: string;
  membershipId: string;
  expiryTimer?: NodeJS.Timeout;
}

// setTimeout tối đa ~24.8 ngày; access token luôn ngắn hơn nhiều, chặn thêm cho chắc.
const MAX_TIMER_MS = 2 ** 31 - 1;

function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*' },
})
export class ProgressGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ProgressGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      return this.reject(client, 'Missing access token');
    }

    let payload: AccessTokenPayload & { exp?: number };
    try {
      payload = await this.jwtService.verifyAsync<
        AccessTokenPayload & { exp?: number }
      >(token);
    } catch {
      // Không lộ lý do chi tiết (hết hạn / chữ ký sai) cho client; FE chỉ cần biết phải đăng nhập/refresh lại.
      return this.reject(client, 'Invalid or expired access token');
    }
    if (!payload.tenantId || !payload.membershipId || !payload.identityId) {
      return this.reject(client, 'Invalid access token');
    }

    const data: AuthenticatedSocketData = {
      tenantId: payload.tenantId,
      identityId: payload.identityId,
      membershipId: payload.membershipId,
    };
    client.data = data;
    await client.join(tenantRoom(payload.tenantId));

    // Ngắt đúng lúc token hết hạn để quyền bị thu hồi không kéo dài theo vòng đời socket.
    if (typeof payload.exp === 'number') {
      const ms = Math.min(
        Math.max(payload.exp * 1000 - Date.now(), 0),
        MAX_TIMER_MS,
      );
      data.expiryTimer = setTimeout(() => {
        client.emit('auth_error', { message: 'Access token expired' });
        client.disconnect(true);
      }, ms);
      data.expiryTimer.unref?.();
    }

    this.logger.debug(
      `Client ${client.id} xác thực OK, join room ${tenantRoom(payload.tenantId)}`,
    );
  }

  handleDisconnect(client: Socket): void {
    const timer = (client.data as Partial<AuthenticatedSocketData> | undefined)
      ?.expiryTimer;
    if (timer) clearTimeout(timer);
    this.logger.debug(`Client ngắt kết nối: ${client.id}`);
  }

  /**
   * Gọi từ DocumentProcessingProcessor ở mỗi bước (extract -> chunk -> embed -> indexing xong).
   * Emit event `document.progress` chỉ tới client đã xác thực thuộc đúng tenant.
   */
  emitProgress(tenantId: string, payload: DocumentProgressPayload): void {
    this.server.to(tenantRoom(tenantId)).emit('document.progress', payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as { token?: unknown } | undefined)
      ?.token;
    if (typeof authToken === 'string' && authToken.length > 0) return authToken;

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string') {
      const [scheme, value] = header.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && value) return value;
    }
    return null;
  }

  private reject(client: Socket, message: string): void {
    client.emit('auth_error', { message });
    client.disconnect(true);
  }
}
