import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MembersSettingsTab } from "./members-settings-tab";
import type { MemberItem } from "../schemas/member-schemas";
import type { PendingInvitationItem } from "../schemas/invitation-schemas";

const mockUser = {
  identity: { id: "id-1", email: "owner@docmind.local" },
  tenant: { id: "tenant-1", name: "DocMind Org", slug: "docmind", plan: "PRO" },
  membership: { role: "OWNER", status: "ACTIVE" },
};

const mockMembers: MemberItem[] = [
  {
    id: "mem-1",
    tenantId: "tenant-1",
    identityId: "id-1",
    email: "owner@docmind.local",
    displayName: "Lead Owner",
    role: "OWNER",
    status: "ACTIVE",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mem-2",
    tenantId: "tenant-1",
    identityId: "id-2",
    email: "developer@docmind.local",
    displayName: "Dev User",
    role: "MEMBER",
    status: "ACTIVE",
    joinedAt: "2026-02-01T00:00:00.000Z",
  },
];

const mockInvitations: PendingInvitationItem[] = [
  {
    id: "inv-1",
    tenantId: "tenant-1",
    email: "newmate@docmind.local",
    role: "ADMIN",
    token: "token-abc-123",
    invitedById: "mem-1",
    invitedByEmail: "owner@docmind.local",
    expiresAt: "2026-11-10T00:00:00.000Z",
    createdAt: "2026-10-31T00:00:00.000Z",
  },
];

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("../hooks/use-members", () => ({
  useMembers: () => ({
    data: mockMembers,
    isLoading: false,
    error: null,
  }),
  useUpdateMemberRole: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRemoveMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../hooks/use-invitations", () => ({
  usePendingInvitations: () => ({
    data: mockInvitations,
    isLoading: false,
  }),
  useRevokeInvitation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateInvitation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "auth.roleOwner") return "Chủ sở hữu";
      if (key === "auth.roleAdmin") return "Quản trị viên";
      if (key === "auth.roleMember") return "Thành viên";
      if (key === "settings.youBadge") return "Bạn";
      if (key === "settings.copyInviteLink") return "Sao chép liên kết";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

describe("MembersSettingsTab Component", () => {
  it("renders workspace info, members, and pending invitations", () => {
    render(<MembersSettingsTab />);

    expect(screen.getByText("DocMind Org")).toBeDefined();
    expect(screen.getAllByText("owner@docmind.local").length).toBeGreaterThan(0);
    expect(screen.getByText("developer@docmind.local")).toBeDefined();
    expect(screen.getByText("newmate@docmind.local")).toBeDefined();
  });

  it("passes accessibility checks with 0 axe violations", async () => {
    const { container } = render(<MembersSettingsTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
