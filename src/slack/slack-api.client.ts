// Lớp mỏng quanh các lệnh gọi HTTP tới Slack Web API (dùng fetch có sẵn của Node 18+, không thêm thư
// viện). Tách riêng để các service mock được trong test.
import { Injectable } from '@nestjs/common';

export interface SlackOAuthAccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  team?: { id: string; name?: string };
}

export interface SlackPostMessageParams {
  channel: string;
  text: string;
  blocks?: unknown[];
  /** Có giá trị = trả lời trong thread của message có ts này. */
  thread_ts?: string;
}

export interface SlackPostMessageResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
}

@Injectable()
export class SlackApiClient {
  /** Đổi `code` (từ callback) lấy bot token — https://api.slack.com/methods/oauth.v2.access */
  async exchangeCode(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<SlackOAuthAccessResponse> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    });
    return (await response.json()) as SlackOAuthAccessResponse;
  }

  /** Thu hồi token phía Slack khi gỡ kết nối — https://api.slack.com/methods/auth.revoke */
  async revokeToken(token: string): Promise<void> {
    await fetch('https://slack.com/api/auth.revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /**
   * Đăng message vào channel (hoặc vào thread nếu có thread_ts) — https://api.slack.com/methods/chat.postMessage
   * Slack trả HTTP 200 kể cả khi lỗi, kết quả thật nằm ở `ok`/`error` trong body.
   */
  async postMessage(
    token: string,
    params: SlackPostMessageParams,
  ): Promise<SlackPostMessageResponse> {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      // Tắt xem trước link: câu trả lời có thể chứa URL từ tài liệu, không cần bung preview.
      body: JSON.stringify({
        ...params,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    return (await response.json()) as SlackPostMessageResponse;
  }

  /**
   * Trả lời qua `response_url` của slash command (dùng cho thông báo "chỉ mình bạn thấy" — ephemeral).
   * response_url nằm trong request đã được xác thực chữ ký nên đáng tin, nhưng vẫn chỉ cho phép
   * https://*.slack.com để không bao giờ thành điểm SSRF nếu payload bị thay đổi ở đâu đó.
   */
  async respondEphemeral(responseUrl: string, text: string): Promise<void> {
    const url = new URL(responseUrl);
    if (
      url.protocol !== 'https:' ||
      !(url.hostname === 'slack.com' || url.hostname.endsWith('.slack.com'))
    ) {
      throw new Error(
        `Refusing to call non-Slack response_url host: ${url.hostname}`,
      );
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ response_type: 'ephemeral', text }),
    });
  }
}
