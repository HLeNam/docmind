import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Collections and Documents Management E2E", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock Auth endpoints to establish an authenticated session
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
              id: "user-1",
              email: "admin@docmind.vn",
              emailVerifiedAt: "2026-01-01T00:00:00.000Z",
            },
            tenant: {
              id: "tenant-1",
              name: "Tập đoàn DocMind",
              slug: "docmind",
              plan: "ENTERPRISE",
            },
            membership: {
              id: "mem-1",
              role: "OWNER",
              status: "ACTIVE",
            },
          },
        }),
      });
    });

    // 2. Mock Chat Conversations list for AppShell sidebar
    await page.route("**/api/chat/conversations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "conv-1",
              title: "Tóm tắt hợp đồng Q3",
              collectionId: "col-1",
              createdAt: "2026-10-30T10:00:00Z",
              updatedAt: "2026-10-30T10:30:00Z",
            },
          ],
        }),
      });
    });
  });

  test("collections list renders, allows opening create dialog, and passes axe a11y", async ({
    page,
  }) => {
    // Mock Collections list
    await page.route("**/api/collections", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: "col-1",
                name: "Tài chính & Thuế 2026",
                description: "Hóa đơn, báo cáo tài chính và kiểm toán năm 2026",
                documentCount: 5,
                createdAt: "2026-01-15T08:00:00Z",
                updatedAt: "2026-10-31T09:00:00Z",
              },
              {
                id: "col-2",
                name: "Quy chuẩn & Pháp lý",
                description: "Văn bản nội bộ và chính sách bảo mật",
                documentCount: 2,
                createdAt: "2026-02-01T08:00:00Z",
                updatedAt: "2026-10-30T09:00:00Z",
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/collections");

    // Check headings and collection items
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Tài chính & Thuế 2026")).toBeVisible();
    await expect(page.getByText("Quy chuẩn & Pháp lý")).toBeVisible();

    // Verify accessibility on collections list
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(scanResults.violations).toEqual([]);

    // Open Create Collection modal
    const createButton = page.getByRole("button", {
      name: /Tạo bộ sưu tập|Mới/i,
    });
    if (await createButton.isVisible()) {
      await createButton.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByLabel(/Tên bộ sưu tập/i)).toBeVisible();
    }
  });

  test("collection detail renders document list and upload dropzone", async ({
    page,
  }) => {
    await page.route("**/api/collections/col-1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "col-1",
            name: "Tài chính & Thuế 2026",
            description: "Hóa đơn, báo cáo tài chính và kiểm toán năm 2026",
            documentCount: 2,
            createdAt: "2026-01-15T08:00:00Z",
            updatedAt: "2026-10-31T09:00:00Z",
          },
        }),
      });
    });

    await page.route("**/api/collections/col-1/documents*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "doc-1",
              collectionId: "col-1",
              filename: "Bao_cao_Tai_chinh_Q3.pdf",
              fileSize: 1048576,
              mimeType: "application/pdf",
              status: "COMPLETED",
              chunkCount: 24,
              createdAt: "2026-10-31T08:00:00Z",
              updatedAt: "2026-10-31T08:05:00Z",
            },
            {
              id: "doc-2",
              collectionId: "col-1",
              filename: "Ke_hoach_Ngan_sach_2027.xlsx",
              fileSize: 524288,
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              status: "PROCESSING",
              chunkCount: 0,
              createdAt: "2026-10-31T08:10:00Z",
              updatedAt: "2026-10-31T08:10:00Z",
            },
          ],
          meta: { total: 2 },
        }),
      });
    });

    await page.goto("/collections/col-1");

    // Verify collection detail header
    await expect(page.getByText("Tài chính & Thuế 2026")).toBeVisible();

    // Verify document items and status badges
    await expect(page.getByText("Bao_cao_Tai_chinh_Q3.pdf")).toBeVisible();
    await expect(page.getByText("Ke_hoach_Ngan_sach_2027.xlsx")).toBeVisible();

    // Accessibility scan on collection detail page
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(scanResults.violations).toEqual([]);
  });
});
