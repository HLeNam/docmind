import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER, type MailProvider } from './mail-provider.interface.js';
import { MailTemplateService } from './mail-template.service.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
    private readonly templates: MailTemplateService,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService.get<string>('FRONTEND_URL', {
      infer: true,
    })!;
  }

  async sendInvitationEmail(params: {
    to: string;
    tenantName: string;
    inviterEmail: string;
    token: string;
  }) {
    // FRONTEND_URL trỏ vào route FE sẽ dựng ở Phase 3 (chưa có FE thật ở Phase 1) — route đó
    // gọi lại GET /invitations/:token để hiển thị, rồi POST .../accept khi user bấm chấp nhận.
    const acceptUrl = `${this.frontendUrl}/accept-invite?token=${params.token}`;

    const { subject, html } = await this.templates.renderInvitation({
      tenantName: params.tenantName,
      inviterEmail: params.inviterEmail,
      acceptUrl,
    });

    try {
      await this.provider.send({ to: params.to, subject, html });
    } catch (err) {
      // Không throw ra ngoài — invitation đã lưu DB thành công trước khi gọi hàm này, lỗi gửi mail
      // (provider down, sai config...) không nên làm fail toàn bộ request tạo invitation.
      // Log lại để Admin biết mà tự gửi link tay nếu cần — đánh đổi chấp nhận được cho Phase 1,
      // nâng cấp thật (retry qua BullMQ) để dành Phase 2 khi đã có queue infrastructure.
      this.logger.error(`Failed to send invitation email to ${params.to}`, err);
    }
  }
}
