import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME and E2E_PASSWORD must be set. " +
        "Add them to .env or pass as environment variables.",
    );
  }

  await page.goto("/login");

  // Fill credentials using the login form's known IDs
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);

  // Submit
  await page.getByRole("button", { name: /Sign in/i }).click();

  // Wait for redirect to dashboard (authenticated home page)
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  // Verify we're actually logged in — nav should be visible
  await expect(page.getByRole("navigation")).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
