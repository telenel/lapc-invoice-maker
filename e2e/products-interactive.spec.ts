import { test, expect } from "@playwright/test";

test.describe("Products — interactive presets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/products");
  });

  test("clicking a system preset updates the URL with ?view=", async ({ page }) => {
    // Wait for the SavedViewsBar to load (either from API or fallback to system presets)
    const neverSoldChip = page.getByRole("button", { name: "Never sold" });
    await expect(neverSoldChip).toBeVisible({ timeout: 10_000 });

    await neverSoldChip.click();

    await expect(page).toHaveURL(/[?&]view=dead-never-sold/);
    await expect(neverSoldChip).toHaveAttribute("aria-pressed", "true");
  });

  test("keyboard navigation cycles focus between preset chips", async ({ page }) => {
    // Wait for the SavedViewsBar to load
    const firstChip = page.getByRole("button", { name: "Discontinued with stock" });
    await expect(firstChip).toBeVisible({ timeout: 10_000 });

    // Focus the first chip and navigate right
    await firstChip.focus();
    await page.keyboard.press("ArrowRight");

    // The next chip should now be focused
    const secondChip = page.getByRole("button", { name: "Never sold" });
    await expect(secondChip).toBeFocused();
  });

  test("column toggle persists across reload", async ({ page }) => {
    // Wait for the Columns button to appear
    const columnsButton = page.getByRole("button", { name: /^Columns/ });
    await expect(columnsButton).toBeVisible({ timeout: 10_000 });

    // Open the column visibility popover
    await columnsButton.click();

    // Toggle Est. annual sales ON (it's not in DEFAULT_COLUMN_SET)
    const estSalesCheckbox = page.getByLabel("Est. annual sales");
    await expect(estSalesCheckbox).toBeVisible({ timeout: 5_000 });
    await estSalesCheckbox.check();

    // Close the popover by pressing Escape
    await page.keyboard.press("Escape");

    // Wait briefly for localStorage to sync
    await page.waitForTimeout(500);

    // Reload and confirm the column is still visible
    await page.reload();

    // The column header should be present after reload
    await expect(page.getByRole("columnheader", { name: "Est. annual sales" })).toBeVisible({ timeout: 10_000 });
  });

  test("Pierce assurance badge is visible in the header", async ({ page }) => {
    // The badge renders as a button with role="status" containing "Pierce"
    await expect(page.getByRole("status").filter({ hasText: "Pierce" })).toBeVisible({ timeout: 10_000 });
  });
});
