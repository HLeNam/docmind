import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UsageSettingsTab } from "./usage-settings-tab";
import type { UsageSummaryResponse } from "../schemas/usage-schemas";

const mockUser = {
  identity: { id: "id-1", email: "owner@docmind.local" },
  tenant: { id: "tenant-1", name: "DocMind Org", slug: "docmind", plan: "PRO" },
  membership: { role: "OWNER", status: "ACTIVE" },
};

const mockUsage: UsageSummaryResponse = {
  from: "2026-10-01",
  to: "2026-10-31",
  totals: {
    tokens: 15400,
    costUsd: 0.0456,
    records: 24,
    byType: {
      GENERATION: { records: 14, tokens: 12000, costUsd: 0.036 },
      EMBEDDING: { records: 10, tokens: 3400, costUsd: 0.0096 },
    },
  },
  daily: [
    {
      date: "2026-10-30",
      tokens: 8000,
      generationTokens: 6000,
      embeddingTokens: 2000,
      costUsd: 0.024,
    },
    {
      date: "2026-10-31",
      tokens: 7400,
      generationTokens: 6000,
      embeddingTokens: 1400,
      costUsd: 0.0216,
    },
  ],
};

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("../hooks/use-usage", () => ({
  useUsageSummary: () => ({
    data: mockUsage,
    isLoading: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "settings.usageTitle") return "Mức độ sử dụng & Chi phí tài nguyên";
      if (key === "settings.totalTokens") return "Tổng Token tiêu thụ";
      if (key === "settings.last30Days") return "30 ngày gần nhất";
      if (key === "settings.last7Days") return "7 ngày gần nhất";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

describe("UsageSettingsTab Component", () => {
  it("renders KPI cards and daily usage rows", () => {
    render(<UsageSettingsTab />);

    expect(screen.getByText("Mức độ sử dụng & Chi phí tài nguyên")).toBeDefined();
    expect(screen.getByText("15,400")).toBeDefined();
    expect(screen.getAllByText("2026-10-30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-10-31").length).toBeGreaterThan(0);
  });

  it("passes accessibility checks with 0 axe violations", async () => {
    const { container } = render(<UsageSettingsTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
