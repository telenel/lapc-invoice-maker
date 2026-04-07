import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  // These tests run WITHOUT the shared auth state — they test the login flow itself
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page renders with form fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /LAPortal/i })).toBeVisible();
    await expect(page.getByText("Los Angeles Pierce College").first()).toBeVisible();
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#remember-me")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  });

  test("invalid credentials show error message", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#username").fill("wrong@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: /Sign in/i }).click();

    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("valid login redirects to dashboard", async ({ page }) => {
    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;
    test.skip(!username || !password, "E2E_USERNAME/E2E_PASSWORD not set");

    await page.goto("/login");

    await page.locator("#username").fill(username!);
    await page.locator("#password").fill(password!);
    await page.getByRole("button", { name: /Sign in/i }).click();

    await expect(page).toHaveURL("/", { timeout: 15_000 });
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/invoices");

    // Middleware should redirect to /login with callbackUrl
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated access to other protected routes redirects", async ({ page }) => {
    const protectedRoutes = ["/quotes", "/staff", "/calendar", "/analytics", "/admin/settings"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    }
  });
});

