import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Authentication and Accessibility E2E", () => {
  test("login page renders cleanly with zero axe a11y violations", async ({
    page,
  }) => {
    await page.goto("/login");

    // Expect Title and form elements
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();

    // Check accessibility with axe
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("registration page renders form fields and validation indicators", async ({
    page,
  }) => {
    await page.goto("/register");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#register-email")).toBeVisible();
    await expect(page.locator("#register-password")).toBeVisible();
    await expect(page.locator("#register-tenant-name")).toBeVisible();
  });

  test("accept invitation page renders for valid route structure", async ({
    page,
  }) => {
    await page.goto("/accept-invite?token=sample-test-token");

    // Route redirects to /invitations/sample-test-token
    await expect(page).toHaveURL(/\/invitations\/sample-test-token/);
  });
});
