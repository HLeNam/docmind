import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Settings and Workspace Management E2E", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock Auth endpoints
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { accessToken: "mock-valid-jwt-token" },
        }),
      });
    });

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            identity: {
              id: "user-owner",
              email: "owner@docmind.vn",
              emailVerifiedAt: "2026-01-01T00:00:00.000Z",
            },
            tenant: {
              id: "tenant-corp",
              name: "DocMind Global",
              slug: "docmind-corp",
              plan: "ENTERPRISE",
            },
            membership: {
              id: "mem-owner",
              role: "OWNER",
              status: "ACTIVE",
            },
          },
        }),
      });
    });

    // 2. Mock Chat Conversations for AppShell
    await page.route("**/api/chat/conversations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    // 3. Mock Members and Invitations
    await page.route("**/api/members", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "mem-owner",
              userId: "user-owner",
              email: "owner@docmind.vn",
              name: "Nguyễn Quản Trị",
              role: "OWNER",
              status: "ACTIVE",
              createdAt: "2026-01-01T00:00:00Z",
            },
            {
              id: "mem-2",
              userId: "user-2",
              email: "dev@docmind.vn",
              name: "Trần Kỹ Sư",
              role: "ADMIN",
              status: "ACTIVE",
              createdAt: "2026-02-01T00:00:00Z",
            },
          ],
        }),
      });
    });

    await page.route("**/api/members/invitations*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    // 4. Mock API Keys
    await page.route("**/api/api-keys*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "key-1",
              name: "Production Backend Key",
              prefix: "dm_live_98a7",
              role: "ADMIN",
              createdAt: "2026-03-01T00:00:00Z",
              expiresAt: null,
              lastUsedAt: "2026-10-31T08:00:00Z",
            },
          ],
        }),
      });
    });

    // 5. Mock Slack integration
    await page.route("**/api/integrations/slack*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            connected: false,
          },
        }),
      });
    });

    // 6. Mock Usage stats
    await page.route("**/api/settings/usage*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            tenantId: "tenant-corp",
            plan: "ENTERPRISE",
            periodStart: "2026-10-01T00:00:00Z",
            periodEnd: "2026-10-31T23:59:59Z",
            totalTokens: 1254300,
            storageBytes: 524288000,
            maxStorageBytes: 10737418240,
            totalQueries: 8420,
            documentsCount: 45,
          },
        }),
      });
    });
  });

  test("settings tabs navigate cleanly and adhere to accessibility guidelines", async ({
    page,
  }) => {
    await page.goto("/settings");

    // Header & Tab list should be visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Default tab: Thành viên (Members)
    await expect(page.getByText("owner@docmind.vn")).toBeVisible();
    await expect(page.getByText("dev@docmind.vn")).toBeVisible();

    // Check accessibility on Members tab
    const membersScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(membersScan.violations).toEqual([]);

    // Switch to API Keys tab
    const apiKeysTab = page.getByRole("tab", { name: /API Key/i });
    await apiKeysTab.click();
    await expect(page.getByText("Production Backend Key")).toBeVisible();

    const apiKeysScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(apiKeysScan.violations).toEqual([]);

    // Switch to Slack tab
    const slackTab = page.getByRole("tab", { name: /Slack/i });
    await slackTab.click();
    await expect(page.getByRole("tabpanel")).toBeVisible();

    const slackScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(slackScan.violations).toEqual([]);

    // Switch to Thống kê (Usage) tab
    const usageTab = page.getByRole("tab", { name: /Thống kê|Sử dụng/i });
    await usageTab.click();
    await expect(page.getByRole("tabpanel")).toBeVisible();

    const usageScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(usageScan.violations).toEqual([]);
  });
});
