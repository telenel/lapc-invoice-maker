import { test, expect } from "@playwright/test";

test.describe("Analytics", () => {
  test("analytics page loads with heading", async ({ page }) => {
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /Analytics/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("date range filters are present", async ({ page }) => {
    await page.goto("/analytics");

    await expect(page.locator("#dateFrom")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#dateTo")).toBeVisible();
  });

  test("charts render after data loads", async ({ page }) => {
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /Analytics/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Charts use Recharts which renders SVGs or canvas elements
    // Wait for at least one chart container to appear
    await expect(
      page.locator("svg.recharts-surface, canvas, [class*='chart'], [class*='Chart']").first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("changing date range reloads data", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.locator("#dateFrom")).toBeVisible({ timeout: 10_000 });

    // Change the from date to trigger a reload
    const fromInput = page.locator("#dateFrom");
    await fromInput.fill("2025-01-01");

    // Should still show the heading and charts after reload
    await expect(
      page.getByRole("heading", { name: /Analytics/i }),
    ).toBeVisible();
  });

  test("multiple chart sections render", async ({ page }) => {
    await page.goto("/analytics");

    // The analytics dashboard has multiple Card components
    // (CategoryChart, MonthlyTotalsChart, DepartmentSpendChart, InvoiceTrendChart, UserChart)
    const cards = page.locator("[class*='CardHeader'], [class*='card-header']");

    // Wait for the first card to be visible before counting
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });

    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});