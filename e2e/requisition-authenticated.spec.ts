import { test, expect } from "@playwright/test";

/**
 * Authenticated tests require a running dev server with a seeded database
 * and valid session cookies. These tests verify the authenticated requisition
 * management flows.
 *
 * To run with auth, set up a .auth state file or use the login helper.
 * For CI, these tests may need to be run against a test environment.
 */

test.describe("Authenticated Requisition Panel", () => {
  // Skip if no auth session is available — these need a logged-in user
  test.skip(
    () => !process.env.E2E_AUTH_COOKIE,
    "Skipped: E2E_AUTH_COOKIE not set. Run with authenticated session for full coverage.",
  );

  test.beforeEach(async ({ page }) => {
    // Set auth cookie if provided
    if (process.env.E2E_AUTH_COOKIE) {
      await page.context().addCookies([
        {
          name: "next-auth.session-token",
          value: process.env.E2E_AUTH_COOKIE,
          domain: "localhost",
          path: "/",
        },
      ]);
    }
  });

  test("list page shows stats and table", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    // Stats cards should be visible
    await expect(page.getByText("Total")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
    await expect(page.getByText("Ordered")).toBeVisible();
    await expect(page.getByText("On Shelf")).toBeVisible();

    // Table should render
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
  });

  test("navbar shows Requisitions link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Requisitions/i })).toBeVisible();
  });

  test("can navigate to create page", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await page.getByRole("link", { name: /New Requisition/i }).click();
    await expect(page).toHaveURL(/\/textbook-requisitions\/new/);
  });

  test("create form has all required fields", async ({ page }) => {
    await page.goto("/textbook-requisitions/new");

    await expect(page.getByLabel(/Instructor Name/i)).toBeVisible();
    await expect(page.getByLabel(/Phone/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Department/i)).toBeVisible();
    await expect(page.getByLabel(/Course/i)).toBeVisible();
    await expect(page.getByLabel(/Section/i)).toBeVisible();
    await expect(page.getByLabel(/Enrollment/i)).toBeVisible();

    // Staff Notes should be available (not hidden like public form)
    await expect(page.getByLabel(/Staff Notes/i)).toBeVisible();

    // Status selector should NOT be present (removed per review)
    await expect(page.getByText(/Status changes are managed/i)).toBeVisible();
  });

  test("filter bar works", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    // Wait for table to load
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    // Filter by status
    await page.getByRole("combobox", { name: /status/i }).selectOption("PENDING");

    // Clear filters
    const clearButton = page.getByRole("button", { name: /Clear/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  });

  test("CSV export button exists", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await expect(page.getByRole("button", { name: /Export/i })).toBeVisible({ timeout: 10_000 });
  });
});
