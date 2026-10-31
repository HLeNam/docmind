import { describe, it, expect } from "vitest";
import {
  updateMemberRoleSchema,
  memberItemSchema,
  removeMemberResponseSchema,
} from "./member-schemas";

describe("updateMemberRoleSchema validation", () => {
  it("accepts ADMIN role", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "ADMIN" });
    expect(result.success).toBe(true);
  });

  it("accepts MEMBER role", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "MEMBER" });
    expect(result.success).toBe(true);
  });

  it("rejects OWNER role", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "OWNER" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role string", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "SUPERADMIN" });
    expect(result.success).toBe(false);
  });
});

describe("memberItemSchema validation", () => {
  it("validates full member object successfully", () => {
    const mockMember = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      tenantId: "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
      identityId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      email: "alex@docmind.local",
      displayName: "Alex Nguyen",
      role: "ADMIN",
      status: "ACTIVE",
      joinedAt: "2026-01-15T08:30:00.000Z",
    };

    const result = memberItemSchema.safeParse(mockMember);
    expect(result.success).toBe(true);
  });

  it("allows null displayName", () => {
    const mockMember = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      tenantId: "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
      identityId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      email: "alex@docmind.local",
      displayName: null,
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: "2026-01-15T08:30:00.000Z",
    };

    const result = memberItemSchema.safeParse(mockMember);
    expect(result.success).toBe(true);
  });
});

describe("removeMemberResponseSchema validation", () => {
  it("validates remove response", () => {
    const result = removeMemberResponseSchema.safeParse({
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      removed: true,
    });
    expect(result.success).toBe(true);
  });
});
