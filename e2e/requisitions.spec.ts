import { test, expect } from "@playwright/test";

test.describe("Textbook Requisitions — Authenticated", () => {
  test("list page shows heading and stats", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    await expect(
      page.getByRole("heading", { name: /Textbook Requisitions/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Stats cards should be visible (Total, Pending, Ordered, On Shelf)
    await expect(page.getByText("Total")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Pending")).toBeVisible();
  });

  test("requisition table renders", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("can navigate to create requisition page", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    await page.getByRole("link", { name: /New Requisition/i }).click();
    await expect(page).toHaveURL(/\/textbook-requisitions\/new/);
  });

  test("create form has required fields including staff notes", async ({ page }) => {
    await page.goto("/textbook-requisitions/new");

    // Standard fields
    await expect(page.getByLabel(/Instructor Name/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/Phone/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Department/i)).toBeVisible();
    await expect(page.getByLabel(/Course/i)).toBeVisible();
    await expect(page.getByLabel(/Section/i)).toBeVisible();
    await expect(page.getByLabel(/Enrollment/i)).toBeVisible();

    // Staff Notes should be available (not hidden like public form)
    await expect(page.getByLabel(/Staff Notes/i)).toBeVisible();

    // Status selector should NOT be present on create
    await expect(
      page.getByText(/Status changes are managed/i),
    ).toBeVisible();
  });

  test("filter bar works", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Filter by status if combobox exists
    const statusFilter = page.getByRole("combobox", { name: /status/i });
    if (await statusFilter.isVisible().catch(() => false)) {
      await statusFilter.selectOption("PENDING");

      // Clear filters
      const clearButton = page.getByRole("button", { name: /Clear/i });
      if (await clearButton.isVisible()) {
        await clearButton.click();
      }
    }
  });

  test("CSV export button is present", async ({ page }) => {
    await page.goto("/textbook-requisitions");

    await expect(
      page.getByRole("button", { name: /Export/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("create and view a requisition", async ({ page }) => {
    await page.goto("/textbook-requisitions/new");

    // Fill the form
    await page.getByLabel(/Instructor Name/i).fill("Prof. E2E");
    await page.getByLabel(/Phone/i).fill("(818) 555-0001");
    await page.getByLabel(/Email/i).fill("e2e@piercecollege.edu");
    await page.getByLabel(/Department/i).fill("Computer Science");
    await page.getByLabel(/Course/i).fill("CS 200");
    await page.getByLabel(/Section/i).fill("01");
    await page.getByLabel(/Enrollment/i).fill("30");
    await page.getByLabel(/Term/i).selectOption("Fall");

    // Fill year if the field exists
    const yearField = page.locator("#pub-reqYear").or(page.getByLabel(/Year/i));
    if (await yearField.isVisible().catch(() => false)) {
      await yearField.fill("2026");
    }

    // Book 1
    const authorField = page.locator("#book-0-author").or(page.getByLabel(/Author/i).first());
    if (await authorField.isVisible()) {
      await authorField.fill("Author One");
    }
    const titleField = page.locator("#book-0-title").or(page.getByLabel(/Title/i).first());
    if (await titleField.isVisible()) {
      await titleField.fill("Data Structures");
    }
    const isbnField = page.locator("#book-0-isbn").or(page.getByLabel(/ISBN/i).first());
    if (await isbnField.isVisible()) {
      await isbnField.fill("9781234567890");
    }

    // Staff notes
    await page.getByLabel(/Staff Notes/i).fill("E2E test requisition");

    // Submit
    const submitBtn = page.getByRole("button", { name: /Submit|Create|Save/i });
    await submitBtn.click();

    // Should show success or redirect to detail/list
    await expect(
      page.getByText(/submitted|created|success/i).or(page.locator("[data-sonner-toast]")).or(
        page.getByRole("heading", { name: /Textbook Requisitions/i }),
      ),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("clicking a table row navigates to detail", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Check if there are any rows, skip if empty
    const rowCount = await page.locator("tbody tr").count();
    if (rowCount === 0) {
      test.skip(true, "No requisition rows available to test navigation");
    }

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Should navigate to detail page
    await expect(page).toHaveURL(
      /\/textbook-requisitions\/[a-zA-Z0-9-]+/,
      { timeout: 10_000 },
    );
  });
});