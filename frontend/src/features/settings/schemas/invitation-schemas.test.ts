import { describe, it, expect } from "vitest";
import {
  createInvitationSchema,
  acceptInvitationSchema,
} from "./invitation-schemas";

describe("createInvitationSchema validation", () => {
  it("accepts valid email and MEMBER role", () => {
    const result = createInvitationSchema.safeParse({
      email: "colleague@company.com",
      role: "MEMBER",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid email and ADMIN role", () => {
    const result = createInvitationSchema.safeParse({
      email: "admin@company.com",
      role: "ADMIN",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role like OWNER or VIEWER", () => {
    const result = createInvitationSchema.safeParse({
      email: "owner@company.com",
      role: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = createInvitationSchema.safeParse({
      email: "invalid-email-string",
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
  });
});

describe("acceptInvitationSchema validation", () => {
  it("accepts empty password (for users with existing account)", () => {
    const result = acceptInvitationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts strong password with >=8 chars, uppercase, and digit", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "Password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "Pass1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase letter", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without digits", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "PasswordOnly",
    });
    expect(result.success).toBe(false);
  });
});
