// Lớp mỏng quanh các lệnh gọi HTTP tới Slack Web API (dùng fetch có sẵn của Node 18+, không thêm thư
// viện). Tách riêng để SlackService mock được trong test, và 4.5 (chat.postMessage...) thêm method vào
// đây.
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
}
