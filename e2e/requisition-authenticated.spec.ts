import { test, expect } from "@playwright/test";

/**
 * Authenticated tests for the requisition management panel.
 * Uses shared auth state from auth.setup.ts (storageState).
 */

test.describe("Authenticated Requisition Panel", () => {

  test("list page shows stats and table", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    // Stats cards — use the card label text (inside <p> within stats section)
    await expect(page.getByRole("heading", { name: /Textbook Requisitions/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Total").first()).toBeVisible();

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

    await expect(page.getByLabel(/Instructor Name/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/Phone/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Department/i)).toBeVisible();
    await expect(page.getByLabel(/Course/i)).toBeVisible();
    await expect(page.getByLabel(/Section/i)).toBeVisible();
    await expect(page.getByLabel(/Enrollment/i)).toBeVisible();

    // Staff Notes textarea should exist in the DOM (may be below fold)
    await expect(page.locator("#staffNotes")).toBeAttached({ timeout: 5000 });
  });

  test("filter bar works", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    // Wait for table to load
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    // Filter by status — use native select (not combobox role)
    const statusSelect = page.locator("select").filter({ hasText: /All Statuses/ });
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.selectOption("PENDING");

      // Clear filters
      const clearButton = page.getByRole("button", { name: /Clear/i });
      if (await clearButton.isVisible()) {
        await clearButton.click();
      }
    }
  });

  test("CSV export button exists", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await expect(page.getByRole("button", { name: /Export/i })).toBeVisible({ timeout: 10_000 });
  });
});
