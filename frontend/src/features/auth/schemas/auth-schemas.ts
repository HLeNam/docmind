import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  tenantSlug: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải chứa ít nhất một chữ hoa")
    .regex(/[0-9]/, "Mật khẩu phải chứa ít nhất một chữ số"),
  tenantName: z.string().min(2, "Tên tổ chức/workspace phải có ít nhất 2 ký tự"),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
