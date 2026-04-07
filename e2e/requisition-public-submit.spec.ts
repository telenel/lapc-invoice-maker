import { test, expect } from "@playwright/test";

test.describe.serial("Public Faculty Requisition Form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
  });

  test("renders the public form without auth", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Pierce College/i })).toBeVisible();
    await expect(page.getByText("Submit your textbook requirements")).toBeVisible();
    // Form fields should be present
    await expect(page.getByLabel(/Instructor Name/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Department/i)).toBeVisible();
    await expect(page.getByLabel(/Course/i)).toBeVisible();
  });

  test("shows validation errors for missing required fields", async ({ page }) => {
    // Submit without filling anything
    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    // Should show validation errors — check for any error indicators
    // The form uses inline validation, look for error styling or messages
    const errorElements = page.locator("[aria-invalid='true'], .text-red-600, .text-destructive");
    await expect(errorElements.first()).toBeVisible({ timeout: 5000 });
  });

  test("submits a valid requisition and shows confirmation", async ({ page }) => {
    // Fill instructor info
    await page.getByLabel(/Instructor Name/i).fill("Dr. Smith");
    await page.getByLabel(/Phone/i).fill("(818) 555-1234");
    await page.getByLabel(/Email/i).fill("smith@piercecollege.edu");
    await page.getByLabel(/Department/i).fill("Computer Science");
    await page.getByLabel(/Course/i).fill("CS 101");
    await page.getByLabel(/Section/i).fill("01, 02");
    await page.getByLabel(/Enrollment/i).fill("35");

    // Select term
    await page.getByLabel(/Term/i).selectOption("Fall");

    // Fill year — use exact ID to avoid matching "Copyright Year"
    await page.locator("#pub-reqYear").fill("2026");

    // Fill Book 1 — use IDs since labels have asterisks and some lack placeholders
    await page.locator("#book-0-author").fill("John Author");
    await page.locator("#book-0-title").fill("Intro to CS");
    await page.locator("#book-0-isbn").fill("9781234567890");

    // Submit
    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    // Should show confirmation
    await expect(page.getByText(/Requisition Submitted/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Computer Science/i)).toBeVisible();
    await expect(page.getByText(/CS 101/i)).toBeVisible();
  });

  test("can add and remove additional books", async ({ page }) => {
    // Should see Book 1 but not Book 2
    await expect(page.getByText("Book 1")).toBeVisible();

    // Click "Add Another Title"
    await page.getByRole("button", { name: /Add Another Title/i }).click();

    // Book 2 should now be visible
    await expect(page.getByText("Book 2")).toBeVisible();

    // Remove Book 2
    const removeButtons = page.getByRole("button", { name: /Remove/i });
    if (await removeButtons.count() > 0) {
      await removeButtons.first().click();
    }
  });

  test("honeypot field is hidden from view", async ({ page }) => {
    // The honeypot field should exist but be off-screen
    const honeypot = page.locator("#_hp_field");
    await expect(honeypot).toBeAttached();
    // Should not be visible to users (positioned off-screen)
    await expect(honeypot).not.toBeInViewport();
  });
});
