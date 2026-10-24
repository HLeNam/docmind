import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type {
  MailProvider,
  SendEmailParams,
} from '../mail-provider.interface.js';

@Injectable()
export class ResendMailProvider implements MailProvider {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(configService: ConfigService) {
    this.resend = new Resend(
      configService.get<string>('RESEND_API_KEY', { infer: true }),
    );
    this.from = configService.get<string>('MAIL_FROM', { infer: true })!;
  }

  async send(params: SendEmailParams): Promise<void> {
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }
}
