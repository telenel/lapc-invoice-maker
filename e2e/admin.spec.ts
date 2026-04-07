import { test, expect } from "@playwright/test";

test.describe("Admin Panel", () => {
  test("settings page loads with heading", async ({ page }) => {
    await page.goto("/admin/settings");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("tab navigation is present with all tabs", async ({ page }) => {
    await page.goto("/admin/settings");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i }),
    ).toBeVisible({ timeout: 10_000 });

    // All tabs from SettingsPanel
    const expectedTabs = [
      "Users & Access Codes",
      "Invoice Categories",
      "Account Numbers",
      "Invoices",
      "Quotes",
      "Line Items",
      "Database",
      "General Settings",
    ];

    for (const tabName of expectedTabs) {
      await expect(
        page.getByRole("tab", { name: new RegExp(tabName, "i") }).or(
          page.getByText(tabName),
        ),
      ).toBeVisible();
    }
  });

  test("users tab shows user content", async ({ page }) => {
    await page.goto("/admin/settings?tab=users");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Users tab is the default — should show user management content
    await expect(
      page.getByText(/user/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("categories tab loads", async ({ page }) => {
    await page.goto("/admin/settings?tab=categories");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Should show category management content
    await expect(
      page.getByText(/categor/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("account numbers tab loads", async ({ page }) => {
    await page.goto("/admin/settings?tab=account-codes");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Should show account number management
    await expect(
      page.getByText(/account/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("database tab shows health info", async ({ page }) => {
    await page.goto("/admin/settings?tab=database");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Database health component should render
    await expect(
      page.getByText(/database|health|status/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("switching tabs updates URL", async ({ page }) => {
    await page.goto("/admin/settings");

    await expect(
      page.getByRole("heading", { name: /Admin Panel/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Click on Database tab
    const dbTab = page.getByRole("tab", { name: /Database/i }).or(
      page.getByText("Database").first(),
    );
    await dbTab.click();

    // URL should update with tab param
    await expect(page).toHaveURL(/tab=database/);
  });
});
