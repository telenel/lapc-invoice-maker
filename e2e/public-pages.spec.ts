import { test, expect } from "@playwright/test";

test.describe("Public Pages — No Auth Required", () => {
  // These pages are excluded from auth middleware and should work without login
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe("Faculty Requisition Form", () => {
    test("renders the public form without auth", async ({ page }) => {
      await page.goto("/textbook-requisitions/submit");

      await expect(page.getByRole("heading", { name: /Pierce College/i })).toBeVisible();
      await expect(page.getByLabel(/Instructor Name/i)).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Department/i)).toBeVisible();
      await expect(page.getByLabel(/Course/i)).toBeVisible();
    });

    test("can fill and submit the form", async ({ page }) => {
      await page.goto("/textbook-requisitions/submit");

      await page.getByLabel(/Instructor Name/i).fill("Dr. E2E Test");
      await page.getByLabel(/Phone/i).fill("(818) 555-9999");
      await page.getByLabel(/Email/i).fill("e2etest@piercecollege.edu");
      await page.getByLabel(/Department/i).fill("Testing");
      await page.getByLabel(/Course/i).fill("TEST 100");
      await page.getByLabel(/Section/i).fill("01");
      await page.getByLabel(/Enrollment/i).fill("25");
      await page.getByLabel(/Term/i).selectOption("Fall");
      await page.locator("#pub-reqYear").fill("2026");

      // Book 1
      await page.locator("#book-0-author").fill("Test Author");
      await page.locator("#book-0-title").fill("E2E Testing Guide");
      await page.locator("#book-0-isbn").fill("9780000000001");

      await page.getByRole("button", { name: /Submit Requisition/i }).click();

      // Accept either success or rate-limit error
      await expect(
        page.getByText(/Requisition Submitted/i).or(
          page.getByText(/too many submissions/i),
        ),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("Pricing Calculator", () => {
    test("renders the calculator without auth", async ({ page }) => {
      await page.goto("/pricing-calculator");

      // Should load without redirect to login
      await expect(page).toHaveURL(/\/pricing-calculator/);

      // Should have some form of calculator UI
      await expect(page.locator("main, [role='main'], .container, #__next").first()).toBeVisible();
    });
  });

  test.describe("Public Quote Page", () => {
    test("invalid token shows not-found after loading", async ({ page }) => {
      await page.goto("/quotes/review/invalid-token-12345");

      // Should NOT redirect to login
      await expect(page).not.toHaveURL(/\/login/, { timeout: 3_000 });

      // Wait for loading to complete — page first shows "Loading quote..."
      // then transitions to "Quote Not Found" or an error message
      await expect(
        page.getByRole("heading", { name: /Quote Not Found/i }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe("API Version Endpoint", () => {
    test("GET /api/version returns build info", async ({ request }) => {
      const response = await request.get("/api/version");
      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body).toHaveProperty("buildSha");
    });
  });
});
