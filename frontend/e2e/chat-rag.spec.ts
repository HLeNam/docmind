import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Chat RAG and Citations E2E", () => {
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
              id: "user-1",
              email: "analyst@docmind.vn",
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
              role: "MEMBER",
              status: "ACTIVE",
            },
          },
        }),
      });
    });

    // 2. Mock Collections list for filter selector
    await page.route("**/api/collections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "col-1",
              name: "Tài chính & Thuế 2026",
              description: "Hóa đơn và báo cáo tài chính",
              documentCount: 3,
            },
          ],
        }),
      });
    });

    // 3. Mock Conversations
    await page.route("**/api/chat/conversations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "conv-1",
              title: "Doanh thu Q3 và chỉ số tăng trưởng",
              collectionId: "col-1",
              createdAt: "2026-10-31T09:00:00Z",
              updatedAt: "2026-10-31T09:30:00Z",
            },
          ],
        }),
      });
    });

    await page.route("**/api/chat/conversations/conv-1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "conv-1",
            title: "Doanh thu Q3 và chỉ số tăng trưởng",
            collectionId: "col-1",
            createdAt: "2026-10-31T09:00:00Z",
            updatedAt: "2026-10-31T09:30:00Z",
          },
        }),
      });
    });

    // 4. Mock Conversation Messages with Assistant Citations & Snippets
    await page.route("**/api/chat/conversations/conv-1/messages*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "msg-1",
              conversationId: "conv-1",
              role: "user",
              content: "Doanh thu thuần quý 3 năm 2026 đạt bao nhiêu?",
              createdAt: "2026-10-31T09:01:00Z",
            },
            {
              id: "msg-2",
              conversationId: "conv-1",
              role: "assistant",
              content:
                "Theo báo cáo tài chính [1], doanh thu thuần hợp nhất quý 3 năm 2026 đạt 1.450 tỷ VNĐ, tăng 18.5% so với cùng kỳ năm trước nhờ tối ưu hóa chuỗi cung ứng.",
              citations: [
                {
                  index: 1,
                  documentId: "doc-1",
                  filename: "Bao_cao_Tai_chinh_Q3.pdf",
                  chunkIndex: 4,
                  pageNumber: 12,
                  headingContext: "Chỉ tiêu kinh doanh hợp nhất",
                  score: 0.94,
                  snippet:
                    "Tổng doanh thu thuần bán hàng và cung cấp dịch vụ quý 3/2026 ghi nhận mức 1.450.210.000.000 VNĐ, tăng trưởng 18.5% so với mức 1.223.800.000.000 VNĐ của quý 3/2025.",
                },
              ],
              createdAt: "2026-10-31T09:01:05Z",
            },
          ],
        }),
      });
    });
  });

  test("chat view renders messages, citation chips, and source panel", async ({
    page,
  }) => {
    await page.goto("/?c=conv-1");

    // Expect conversation message content
    await expect(
      page.getByText("Doanh thu thuần quý 3 năm 2026 đạt bao nhiêu?")
    ).toBeVisible();
    await expect(
      page.getByText(/Theo báo cáo tài chính/i)
    ).toBeVisible();

    // Citation chip [1] should be visible
    const citationChip = page.getByRole("button", {
      name: /Nguồn 1: Bao_cao_Tai_chinh_Q3\.pdf/i,
    });
    await expect(citationChip).toBeVisible();
    await expect(citationChip).toHaveText(/\[1\]/);

    // Hover on citation chip to inspect tooltip
    await citationChip.hover();
    await expect(
      page.getByRole("tooltip").or(page.getByText(/Bao_cao_Tai_chinh_Q3\.pdf/i))
    ).toBeVisible();

    // Click citation chip to open source panel
    await citationChip.click();
    await expect(
      page.getByRole("complementary", { name: /Nguồn trích dẫn/i }).or(
        page.getByText(/Nguồn trích dẫn/i)
      )
    ).toBeVisible();

    // Verify source card and snippet text inside panel
    await expect(
      page.getByText(/1.450.210.000.000 VNĐ/i)
    ).toBeVisible();

    // Verify chat input area
    const chatTextarea = page.getByPlaceholder(/Hỏi về tài liệu|Nhập câu hỏi/i);
    await expect(chatTextarea).toBeVisible();

    // Accessibility scan on chat interface with open source panel
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(scanResults.violations).toEqual([]);
  });
});
