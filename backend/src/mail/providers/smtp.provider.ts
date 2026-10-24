import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type {
  MailProvider,
  SendEmailParams,
} from '../mail-provider.interface.js';

@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('SMTP_HOST', { infer: true }),
      port: configService.get<number>('SMTP_PORT', { infer: true }),
      secure: configService.get<boolean>('SMTP_SECURE', { infer: true }), // true nếu port 465
      auth: {
        user: configService.get<string>('SMTP_USER', { infer: true }),
        pass: configService.get<string>('SMTP_PASSWORD', { infer: true }),
      },
    });
    this.from = configService.get<string>('MAIL_FROM', { infer: true })!;
  }

  async send(params: SendEmailParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }
}
