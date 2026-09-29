import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import type {
  MailProvider,
  SendEmailParams,
} from '../mail-provider.interface.js';

@Injectable()
export class BrevoMailProvider implements MailProvider {
  private readonly client: BrevoClient;
  private readonly sender: { email: string; name?: string };

  constructor(configService: ConfigService) {
    this.client = new BrevoClient({
      apiKey: configService.get<string>('BREVO_API_KEY', { infer: true })!,
    });
    this.sender = parseFromAddress(
      configService.get<string>('MAIL_FROM', { infer: true })!,
    );
  }

  async send(params: SendEmailParams): Promise<void> {
    await this.client.transactionalEmails.sendTransacEmail({
      subject: params.subject,
      htmlContent: params.html,
      sender: this.sender,
      to: [{ email: params.to }],
    });
  }
}

// "DocMind <noreply@domain.com>" -> { name: "DocMind", email: "noreply@domain.com" }.
// Resend/Nodemailer chấp nhận thẳng chuỗi "Name <email>", nhưng Brevo cần object { name, email }
// riêng — parse lại đúng 1 lần ở đây, các provider khác không cần đụng gì.
function parseFromAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { email: raw.trim() };
}
