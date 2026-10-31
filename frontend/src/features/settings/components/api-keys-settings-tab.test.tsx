import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ApiKeysSettingsTab } from "./api-keys-settings-tab";
import type { ApiKeyItem } from "../schemas/api-key-schemas";

const mockUser = {
  identity: { id: "id-1", email: "owner@docmind.local" },
  tenant: { id: "tenant-1", name: "DocMind Org", slug: "docmind", plan: "PRO" },
  membership: { role: "OWNER", status: "ACTIVE" },
};

const mockKeys: ApiKeyItem[] = [
  {
    id: "key-1",
    name: "Production Ingestion Bot",
    keyPrefix: "dm_live_ab12",
    collectionId: null,
    createdAt: "2026-02-01T00:00:00.000Z",
    revokedAt: null,
  },
  {
    id: "key-2",
    name: "Legacy Search Key",
    keyPrefix: "dm_live_cd34",
    collectionId: "col-123",
    createdAt: "2026-01-01T00:00:00.000Z",
    revokedAt: "2026-01-15T00:00:00.000Z",
  },
];

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("../hooks/use-api-keys", () => ({
  useApiKeys: () => ({
    data: mockKeys,
    isLoading: false,
    error: null,
  }),
  useRevokeApiKey: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateApiKey: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  }),
}));

vi.mock("@/features/collections", () => ({
  useCollections: () => ({
    data: [{ id: "col-123", name: "Knowledge Base" }],
    isLoading: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "settings.apiKeysTitle") return "Khóa API";
      if (key === "settings.createApiKey") return "Tạo khóa API mới";
      if (key === "settings.scopeAll") return "Toàn bộ tổ chức";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

describe("ApiKeysSettingsTab Component", () => {
  it("renders API keys list and elements", () => {
    render(<ApiKeysSettingsTab />);

    expect(screen.getByText("Production Ingestion Bot")).toBeDefined();
    expect(screen.getByText("Legacy Search Key")).toBeDefined();
    expect(screen.getByText("Knowledge Base")).toBeDefined();
  });

  it("passes accessibility checks with 0 axe violations", async () => {
    const { container } = render(<ApiKeysSettingsTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
