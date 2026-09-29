import { Injectable } from '@nestjs/common';
import { render } from '@react-email/render';
import InvitationEmail, {
  subject as invitationSubject,
  type InvitationEmailProps,
} from './templates/en/invitation-email.js';

@Injectable()
export class MailTemplateService {
  /**
   * 1 method riêng cho mỗi loại mail — Props định nghĩa ngay trong file .tsx của template đó,
   * nên gọi thiếu/sai field là lỗi biên dịch, không phải lỗi phát hiện lúc gửi mail thật như
   * bản Handlebars (data: Record<string, unknown> không có gì ràng buộc kiểu).
   * Gọi component như hàm thường (InvitationEmail(props)) hoàn toàn hợp lệ — component chức năng
   * chỉ là 1 hàm trả về React element, không bắt buộc phải viết bằng cú pháp JSX mới gọi được.
   *
   * async vì render() từ @react-email/render trả về Promise<string> ở bản hiện tại (khác bản cũ
   * chạy đồng bộ) — quên await sẽ gán nhầm Promise<string> vào field html: string, TypeScript
   * báo lỗi ngay lúc build (TS2322), không phải lỗi runtime.
   */
  async renderInvitation(
    props: InvitationEmailProps,
  ): Promise<{ subject: string; html: string }> {
    return {
      subject: invitationSubject(props),
      html: await render(InvitationEmail(props)),
    };
  }

  // Thêm template mới -> thêm 1 method renderXxx(...) tương tự. Chỉ cân nhắc đổi sang
  // 1 registry chung (Map<name, {component, subject}>) nếu số lượng template lên tới hàng chục.
}
