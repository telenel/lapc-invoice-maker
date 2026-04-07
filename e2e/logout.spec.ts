import { test, expect } from "@playwright/test";

test.describe("Logout", () => {
  test("logout returns to login page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible({ timeout: 10_000 });

    // Click the sign out button (desktop nav)
    await page.getByRole("button", { name: /Sign out/i }).click();

    // Confirm dialog should appear
    await expect(page.getByText(/Are you sure you want to sign out/i)).toBeVisible();
    await page.getByRole("button", { name: /Sign out/i }).last().click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
