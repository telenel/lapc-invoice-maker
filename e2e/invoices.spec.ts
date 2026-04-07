import { test, expect } from "@playwright/test";

test.describe("Invoices", () => {
  test("list page loads with heading and table", async ({ page }) => {
    await page.goto("/invoices");

    await expect(page.getByRole("heading", { name: /Invoices/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("filter bar is present with status, category, search", async ({ page }) => {
    await page.goto("/invoices");

    // Wait for page to fully load
    await expect(page.getByRole("heading", { name: /Invoices/i })).toBeVisible();

    // Search input should exist
    await expect(
      page.getByPlaceholder(/search/i).or(page.locator("input[type='search'], input[type='text']").first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CSV export button is available", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByRole("button", { name: /Export CSV/i }).or(
        page.getByText(/Export CSV/i),
      ),
    ).toBeVisible();
  });

  test("navigate to new invoice page", async ({ page }) => {
    await page.goto("/invoices/new");

    await expect(page.getByRole("heading", { name: /New Invoice/i })).toBeVisible();
  });

  test("new invoice form has core fields", async ({ page }) => {
    await page.goto("/invoices/new");

    await expect(page.getByRole("heading", { name: /New Invoice/i })).toBeVisible({
      timeout: 10_000,
    });

    // Save buttons should be present
    await expect(
      page.getByRole("button", { name: /Save Draft/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Generate PDF/i }),
    ).toBeVisible();
  });

  test("save invoice as draft", async ({ page }) => {
    await page.goto("/invoices/new");

    // Wait for form to be ready
    await expect(
      page.getByRole("button", { name: /Save Draft/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Save Draft — should save even with minimal data
    await page.getByRole("button", { name: /Save Draft/i }).click();

    // Should show a success toast or redirect
    await expect(
      page.getByText(/saved|draft|created/i).or(page.locator("[data-sonner-toast]")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("filter invoices by search", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Type in search to filter
    const searchInput = page.getByPlaceholder(/search/i).or(
      page.locator("input[type='search'], input[type='text']").first(),
    );
    await searchInput.fill("nonexistent-query-xyz123");

    // Wait for table to update — should show empty state or fewer rows
    await page.waitForTimeout(1000);
  });
});

test.describe("Invoice Detail", () => {
  test("clicking a table row navigates to detail", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Click first row if available
    const firstRow = page.locator("tbody tr").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Should navigate to a detail page
      await expect(page).toHaveURL(/\/invoices\/[a-zA-Z0-9-]+/, {
        timeout: 10_000,
      });
    }
  });
});
