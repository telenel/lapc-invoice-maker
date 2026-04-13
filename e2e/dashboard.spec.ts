import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders personalized greeting", async ({ page }) => {
    // The greeting is time-dependent: "Good morning/afternoon/evening"
    await expect(
      page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("quick action buttons are present", async ({ page }) => {
    await expect(page.getByRole("link", { name: /New Quote/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /New Invoice/i })).toBeVisible();
  });

  test("nav links are all present", async ({ page }) => {
    const expectedLinks = [
      "Dashboard",
      "Invoices",
      "Quotes",
      "Requisitions",
      "Calendar",
      "Staff",
    ];

    for (const label of expectedLinks) {
      await expect(
        page.getByRole("link", { name: new RegExp(label, "i") }).first(),
      ).toBeVisible();
    }
  });

  test("nav links navigate to correct pages", async ({ page }) => {
    // Test a few key nav links
    await page.getByRole("link", { name: /Invoices/i }).first().click();
    await expect(page).toHaveURL(/\/invoices/);

    await page.getByRole("link", { name: /Quotes/i }).first().click();
    await expect(page).toHaveURL(/\/quotes/);

    await page.getByRole("link", { name: /Staff/i }).first().click();
    await expect(page).toHaveURL(/\/staff/);
  });

  test("dashboard widgets render", async ({ page }) => {
    // Wait for the draggable dashboard to load (it's dynamically imported)
    // Look for any card or widget content — these are loaded asynchronously
    const cards = page.locator("[class*='card'], [class*='Card']");
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });

    // Should have multiple dashboard widgets
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("notification bell is present", async ({ page }) => {
    // The notification bell is in the nav
    await expect(
      page.getByRole("button", { name: /notifications/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
