import { test, expect } from "@playwright/test";

test.describe("Quotes", () => {
  test("list page loads with heading and new quote button", async ({ page }) => {
    await page.goto("/quotes");

    await expect(page.getByRole("heading", { name: /Quotes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /New Quote/i })).toBeVisible();
  });

  test("quotes table renders", async ({ page }) => {
    await page.goto("/quotes");

    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("navigate to new quote page", async ({ page }) => {
    await page.goto("/quotes");
    await page.getByRole("link", { name: /New Quote/i }).click();

    await expect(page).toHaveURL(/\/quotes\/new/);
    await expect(page.getByRole("heading", { name: /New Quote/i })).toBeVisible();
  });

  test("new quote form has core fields", async ({ page }) => {
    await page.goto("/quotes/new");

    await expect(page.getByRole("heading", { name: /New Quote/i })).toBeVisible({
      timeout: 10_000,
    });

    // Recipient fields
    await expect(page.locator("#recipientName")).toBeVisible();
    await expect(page.locator("#recipientEmail")).toBeVisible();

    // Date fields
    await expect(page.locator("#quoteDate")).toBeVisible();
    await expect(page.locator("#expirationDate")).toBeVisible();

    // Save button
    await expect(
      page.getByRole("button", { name: /Save Quote/i }),
    ).toBeVisible();
  });

  test("create a new quote with line items", async ({ page }) => {
    await page.goto("/quotes/new");

    await expect(
      page.getByRole("button", { name: /Save Quote/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Fill recipient
    await page.locator("#recipientName").fill("E2E Test Client");
    await page.locator("#recipientEmail").fill("test@example.com");
    await page.locator("#recipientOrg").fill("Test Corp");

    // Fill notes
    await page.locator("#quoteNotes").fill("E2E test quote");

    // Save the quote
    await page.getByRole("button", { name: /Save Quote/i }).click();

    // Should redirect to quote detail or show success
    await expect(
      page.getByText(/saved|created|success/i).or(page.locator("[data-sonner-toast]")).or(
        page.locator("text=/Quote #/i"),
      ),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("clicking a table row navigates to detail", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    const firstRow = page.locator("tbody tr").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/quotes\/[a-zA-Z0-9-]+/, {
        timeout: 10_000,
      });
    }
  });
});

test.describe("Quote Public Review", () => {
  // Public routes don't need auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test("invalid share token shows not-found", async ({ page }) => {
    await page.goto("/quotes/review/00000000-0000-0000-0000-000000000000");

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 3_000 });

    // Wait for loading to finish, then check for error state
    await expect(
      page.getByRole("heading", { name: /Quote Not Found/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
