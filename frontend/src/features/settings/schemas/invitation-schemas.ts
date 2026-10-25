import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  role: z.enum(["ADMIN", "MEMBER"], {
    errorMap: () => ({ message: "Vui lòng chọn vai trò hợp lệ (ADMIN hoặc MEMBER)" }),
  }),
});

export type CreateInvitationFormData = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  password: z
    .string()
    .min(8, "Mật khẩu tối thiểu 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ in hoa")
    .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 chữ số")
    .optional(),
});

export type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>;

export interface InvitationResponse {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  token: string;
  invitedById: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationInfoResponse {
  email: string;
  role: string;
  tenantName: string;
  expiresAt: string;
}
