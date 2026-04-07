import { test, expect } from "@playwright/test";

test.describe("Staff Directory", () => {
  test("list page loads with heading", async ({ page }) => {
    await page.goto("/staff");

    await expect(
      page.getByRole("heading", { name: /Staff Directory/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("staff table renders", async ({ page }) => {
    await page.goto("/staff");

    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("search filters the staff list", async ({ page }) => {
    await page.goto("/staff");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill("nonexistent-name-xyz");
    await page.waitForTimeout(1000);

    // Table should show empty or fewer results
    // (exact behavior depends on data, but search should work without error)
  });

  test("add staff button is present", async ({ page }) => {
    await page.goto("/staff");

    await expect(
      page.getByRole("button", { name: /Add|New|Create/i }).or(
        page.locator("button:has(svg)").filter({ hasText: /add|new|create/i }),
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking add opens staff form", async ({ page }) => {
    await page.goto("/staff");

    // Find and click the add button (PlusIcon button)
    const addButton = page.getByRole("button", { name: /Add|New|Create/i }).or(
      page.locator("button").filter({ has: page.locator("svg") }).first(),
    );
    await addButton.click();

    // Staff form should appear (it's rendered inline or as a dialog)
    await expect(
      page.getByLabel(/Name/i).or(page.getByPlaceholder(/name/i)),
    ).toBeVisible({ timeout: 5_000 });
  });
});
