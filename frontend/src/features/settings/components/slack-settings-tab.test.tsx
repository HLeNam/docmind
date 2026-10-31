import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { SlackSettingsTab } from "./slack-settings-tab";
import type { SlackChannelMapping } from "../schemas/slack-schemas";

const mockUser = {
  identity: { id: "id-1", email: "owner@docmind.local" },
  tenant: { id: "tenant-1", name: "DocMind Org", slug: "docmind", plan: "PRO" },
  membership: { role: "OWNER", status: "ACTIVE" },
};

const mockChannels: SlackChannelMapping[] = [
  {
    channelId: "C12345678",
    collectionId: "col-1",
    collectionName: "Internal Docs",
  },
];

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("../hooks/use-slack", () => ({
  useSlackIntegration: () => ({
    data: { connected: true, slackTeamId: "T98765432" },
    isLoading: false,
  }),
  useSlackChannels: () => ({
    data: mockChannels,
    isLoading: false,
  }),
  useDisconnectSlack: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRemoveSlackChannel: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpsertSlackChannel: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/features/collections", () => ({
  useCollections: () => ({
    data: [{ id: "col-1", name: "Internal Docs" }],
    isLoading: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "settings.slackTitle") return "Tích hợp Slack";
      if (key === "settings.slackConnected") return "Đã kết nối";
      if (key === "settings.disconnectSlack") return "Ngắt kết nối";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

describe("SlackSettingsTab Component", () => {
  it("renders connected workspace and channel mappings", () => {
    render(<SlackSettingsTab />);

    expect(screen.getByText("Tích hợp Slack")).toBeDefined();
    expect(screen.getByText("C12345678")).toBeDefined();
    expect(screen.getByText("Internal Docs")).toBeDefined();
  });

  it("passes accessibility checks with 0 axe violations", async () => {
    const { container } = render(<SlackSettingsTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
