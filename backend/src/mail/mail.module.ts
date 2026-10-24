import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';
import { MailTemplateService } from './mail-template.service.js';
import { MAIL_PROVIDER } from './mail-provider.interface.js';
import { ResendMailProvider } from './providers/resend.provider.js';
import { SmtpMailProvider } from './providers/smtp.provider.js';
import { BrevoMailProvider } from './providers/brevo.provider.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('MAIL_PROVIDER', { infer: true });
        if (provider === 'smtp') return new SmtpMailProvider(config);
        if (provider === 'resend') return new ResendMailProvider(config);
        if (provider === 'brevo') return new BrevoMailProvider(config);
        throw new Error(
          `MAIL_PROVIDER is invalid: "${provider}" (only accept "resend", "smtp", or "brevo")`,
        );
      },
    },
    MailTemplateService,
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
