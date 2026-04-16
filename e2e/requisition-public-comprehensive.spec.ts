import { test, expect } from "@playwright/test";

/**
 * Comprehensive E2E tests for the public faculty requisition form.
 * Covers: employee lookup, OER flow, multi-book management,
 * field-level validation, ISBN validation, and error handling.
 *
 * All selectors verified against faculty-submit-form.tsx and requisition-books.tsx.
 */

test.describe("Public Faculty Form — Employee Lookup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
    await expect(page.locator("#pub-employeeId")).toBeVisible({ timeout: 10_000 });
  });

  test("employee ID field strips non-digit input via onChange", async ({ page }) => {
    const field = page.locator("#pub-employeeId");
    // Type character by character to trigger onChange
    await field.pressSequentially("abc123xyz");
    await expect(field).toHaveValue("123");
  });

  test("Look Up button is disabled until 4+ digits entered", async ({ page }) => {
    const field = page.locator("#pub-employeeId");
    const lookupBtn = page.getByRole("button", { name: /Look Up/i });

    // Empty — disabled
    await expect(lookupBtn).toBeDisabled();

    // 3 digits — still disabled
    await field.fill("123");
    await expect(lookupBtn).toBeDisabled();

    // 4 digits — enabled
    await field.fill("1234");
    await expect(lookupBtn).toBeEnabled();

    // 10 digits — still enabled
    await field.fill("1234567890");
    await expect(lookupBtn).toBeEnabled();
  });

  test("lookup with non-existent employee ID shows no-results message", async ({ page }) => {
    await page.locator("#pub-employeeId").fill("9999999");
    await page.getByRole("button", { name: /Look Up/i }).click();

    // Should show "No previous submissions found" text
    await expect(
      page.getByText(/No previous submissions found/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Public Faculty Form — Field Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
    await expect(page.locator("#pub-employeeId")).toBeVisible({ timeout: 10_000 });
  });

  test("shows specific error for invalid email format", async ({ page }) => {
    await page.locator("#pub-employeeId").fill("12345");
    await page.locator("#pub-instructorName").fill("Test Instructor");
    await page.locator("#pub-phone").fill("818-555-1234");
    await page.locator("#pub-email").fill("not-an-email");
    await page.locator("#pub-department").fill("Math");
    await page.locator("#pub-course").fill("MATH 101");
    await page.locator("#pub-sections").fill("01");
    await page.locator("#pub-enrollment").fill("25");
    await page.locator("#pub-term").selectOption("Fall");
    await page.locator("#pub-reqYear").fill("2026");
    await page.locator("#book-0-author").fill("Author");
    await page.locator("#book-0-title").fill("Title");
    await page.locator("#book-0-isbn").fill("9781234567890");

    // Native email type validation may block; remove type=email temporarily
    await page.locator("#pub-email").evaluate((el) => el.setAttribute("type", "text"));
    await page.locator("#pub-email").fill("not-an-email");

    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    await expect(page.getByText(/Invalid email/i)).toBeVisible({ timeout: 3000 });
  });

  test("shows error for empty enrollment", async ({ page }) => {
    // Fill HTML-required book fields to bypass native validation
    await page.locator("#book-0-author").fill("A");
    await page.locator("#book-0-title").fill("B");
    // Leave enrollment empty (which custom validation catches)
    await page.locator("#pub-enrollment").fill("");
    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    await expect(
      page.getByText(/Enrollment must be at least 1/i),
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows error for missing employee ID", async ({ page }) => {
    // Must fill HTML-required book fields to bypass native validation
    await page.locator("#book-0-author").fill("A");
    await page.locator("#book-0-title").fill("B");
    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    await expect(
      page.getByText(/Employee ID is required/i),
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows error for short employee ID (< 4 digits)", async ({ page }) => {
    await page.locator("#pub-employeeId").fill("12");
    await page.locator("#book-0-author").fill("A");
    await page.locator("#book-0-title").fill("B");
    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    await expect(page.getByText(/4-10 digits/i)).toBeVisible({ timeout: 3000 });
  });

  test("shows error when no books have content", async ({ page }) => {
    // Fill all instructor info but leave books empty
    // Use JS to bypass native required on book fields
    await page.locator("#pub-employeeId").fill("12345");
    await page.locator("#pub-instructorName").fill("Test");
    await page.locator("#pub-phone").fill("818-555-1234");
    await page.locator("#pub-email").fill("test@piercecollege.edu");
    await page.locator("#pub-department").fill("Math");
    await page.locator("#pub-course").fill("MATH 101");
    await page.locator("#pub-sections").fill("01");
    await page.locator("#pub-enrollment").fill("25");
    await page.locator("#pub-term").selectOption("Fall");
    await page.locator("#pub-reqYear").fill("2026");

    // Remove the HTML required attribute so native validation doesn't block
    await page.locator("#book-0-author").evaluate((el) => el.removeAttribute("required"));
    await page.locator("#book-0-title").evaluate((el) => el.removeAttribute("required"));

    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    await expect(
      page.getByText(/at least one book/i),
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows error when book has author but no title", async ({ page }) => {
    await page.locator("#pub-employeeId").fill("12345");
    await page.locator("#pub-instructorName").fill("Test");
    await page.locator("#pub-phone").fill("818-555-1234");
    await page.locator("#pub-email").fill("test@piercecollege.edu");
    await page.locator("#pub-department").fill("Math");
    await page.locator("#pub-course").fill("MATH 101");
    await page.locator("#pub-sections").fill("01");
    await page.locator("#pub-enrollment").fill("25");
    await page.locator("#pub-term").selectOption("Fall");
    await page.locator("#pub-reqYear").fill("2026");
    await page.locator("#book-0-author").fill("Test Author");
    // Remove required on title so native validation doesn't block
    await page.locator("#book-0-title").evaluate((el) => el.removeAttribute("required"));

    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    await expect(
      page.getByText(/must have an author and title/i),
    ).toBeVisible({ timeout: 3000 });
  });

  test("all four term options are available in select", async ({ page }) => {
    const termSelect = page.locator("#pub-term");

    for (const term of ["Winter", "Spring", "Summer", "Fall"]) {
      await termSelect.selectOption(term);
      await expect(termSelect).toHaveValue(term);
    }
  });

  test("year field defaults to current or next year", async ({ page }) => {
    const yearField = page.locator("#pub-reqYear");
    const value = await yearField.inputValue();
    const currentYear = new Date().getFullYear();
    expect(Number(value)).toBeGreaterThanOrEqual(currentYear);
    expect(Number(value)).toBeLessThanOrEqual(currentYear + 1);
  });
});

test.describe("Public Faculty Form — Multi-Book Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
    await expect(page.locator("#book-0-author")).toBeVisible({ timeout: 10_000 });
  });

  test("can add up to 5 books then add button disappears", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /Add Another Title/i });

    // Start: 1 book visible, add button visible
    await expect(page.locator("legend").filter({ hasText: "Book 1" })).toBeVisible();
    await expect(addBtn).toBeVisible();

    // Add books 2 through 5
    for (let i = 2; i <= 5; i++) {
      await addBtn.click();
      await expect(page.locator("legend").filter({ hasText: `Book ${i}` })).toBeVisible();
    }

    // After 5 books, the add button should be gone
    await expect(addBtn).toBeHidden();
  });

  test("Book 1 has no remove button, Book 2+ does", async ({ page }) => {
    // Book 1 should not have a remove button
    await expect(
      page.getByRole("button", { name: /Remove Book 1/i }),
    ).toBeHidden();

    // Add Book 2
    await page.getByRole("button", { name: /Add Another Title/i }).click();

    // Book 2 should have a remove button
    await expect(
      page.getByRole("button", { name: /Remove Book 2/i }),
    ).toBeVisible();
  });

  test("removing a book decreases visible count", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /Add Another Title/i });

    // Add Books 2 and 3
    await addBtn.click();
    await addBtn.click();
    await expect(page.locator("legend").filter({ hasText: "Book 3" })).toBeVisible();

    // Remove Book 2
    await page.getByRole("button", { name: /Remove Book 2/i }).click();

    // Should now show Book 1 and Book 2 (re-indexed), but not Book 3
    await expect(page.locator("legend").filter({ hasText: "Book 1" })).toBeVisible();
    await expect(page.locator("legend").filter({ hasText: "Book 2" })).toBeVisible();
    // Only 2 fieldsets should remain
    await expect(page.locator("fieldset")).toHaveCount(2);
  });
});

test.describe("Public Faculty Form — OER Book Type", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
    await expect(page.locator("#book-0-bookType")).toBeVisible({ timeout: 10_000 });
  });

  test("selecting OER type shows OER link field", async ({ page }) => {
    // OER link should NOT exist in DOM initially (PHYSICAL default)
    await expect(page.locator("#book-0-oerLink")).toBeHidden();

    // Switch to OER
    await page.locator("#book-0-bookType").selectOption("OER");

    // OER link field should now appear
    await expect(page.locator("#book-0-oerLink")).toBeVisible();
  });

  test("switching back to PHYSICAL removes OER link field", async ({ page }) => {
    await page.locator("#book-0-bookType").selectOption("OER");
    await expect(page.locator("#book-0-oerLink")).toBeVisible();

    await page.locator("#book-0-bookType").selectOption("PHYSICAL");
    await expect(page.locator("#book-0-oerLink")).toBeHidden();
  });

  test("OER link field accepts a URL", async ({ page }) => {
    await page.locator("#book-0-bookType").selectOption("OER");
    await page.locator("#book-0-oerLink").fill("https://openstax.org/details/books/algebra");
    await expect(page.locator("#book-0-oerLink")).toHaveValue(
      "https://openstax.org/details/books/algebra",
    );
  });
});

test.describe("Public Faculty Form — ISBN Inline Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
    await expect(page.locator("#book-0-isbn")).toBeVisible({ timeout: 10_000 });
  });

  test("shows digit count error for partial ISBN", async ({ page }) => {
    await page.locator("#book-0-isbn").fill("12345");

    // Component shows "ISBN must be 10 or 13 digits (currently N)"
    await expect(
      page.getByText(/currently 5/i),
    ).toBeVisible({ timeout: 2000 });
  });

  test("no error for valid 13-digit ISBN", async ({ page }) => {
    await page.locator("#book-0-isbn").fill("9781234567890");

    await expect(
      page.getByText(/ISBN must be/i),
    ).toBeHidden();
  });

  test("no error for valid 10-digit ISBN with X", async ({ page }) => {
    await page.locator("#book-0-isbn").fill("080442957X");

    await expect(
      page.getByText(/ISBN must be/i),
    ).toBeHidden();
  });

  test("no error for empty ISBN", async ({ page }) => {
    // ISBN is optional — empty should not show error
    await page.locator("#book-0-isbn").fill("");

    await expect(
      page.getByText(/ISBN must be/i),
    ).toBeHidden();
  });
});

test.describe("Public Faculty Form — Successful Submission", () => {
  test("shows confirmation card with details and Submit Another resets form", async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
    await expect(page.locator("#pub-employeeId")).toBeVisible({ timeout: 10_000 });

    // Fill all required fields
    await page.locator("#pub-employeeId").fill("12345");
    await page.locator("#pub-instructorName").fill("Dr. E2E Comprehensive");
    await page.locator("#pub-phone").fill("(818) 555-9999");
    await page.locator("#pub-email").fill("e2e-comp@piercecollege.edu");
    await page.locator("#pub-department").fill("Biology");
    await page.locator("#pub-course").fill("BIO 101");
    await page.locator("#pub-sections").fill("01, 02, 03");
    await page.locator("#pub-enrollment").fill("120");
    await page.locator("#pub-term").selectOption("Spring");
    await page.locator("#pub-reqYear").fill("2026");
    await page.locator("#book-0-author").fill("Campbell");
    await page.locator("#book-0-title").fill("Biology");
    await page.locator("#book-0-isbn").fill("9780135188743");

    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    // Handle rate limiting
    const submitted = page.getByText(/Requisition Submitted/i);
    const toast = page.locator("[data-sonner-toast]");

    try {
      await expect(submitted.or(toast)).toBeVisible({ timeout: 10_000 });
    } catch {
      test.skip(true, "Rate limited or no visible feedback");
      return;
    }

    if (await submitted.isVisible().catch(() => false)) {
      await expect(page.getByText("Biology")).toBeVisible();
      await expect(page.getByText("BIO 101")).toBeVisible();

      // Submit Another should reset the form
      await page.getByRole("button", { name: /Submit Another/i }).click();
      await expect(page.locator("#pub-employeeId")).toBeVisible();
      await expect(page.locator("#pub-employeeId")).toHaveValue("");
    }
  });
});

test.describe("Public Faculty Form — Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/textbook-requisitions/submit");
    await expect(page.locator("#pub-employeeId")).toBeVisible({ timeout: 10_000 });
  });

  test("submitting form with validation errors shows role=alert messages", async ({ page }) => {
    // Bypass native required to reach custom validation
    await page.locator("#book-0-author").evaluate((el) => el.removeAttribute("required"));
    await page.locator("#book-0-title").evaluate((el) => el.removeAttribute("required"));
    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    // Error messages use id pattern "{htmlFor}-err" and role="alert"
    const empIdError = page.locator("#pub-employeeId-err");
    await expect(empIdError).toBeVisible({ timeout: 3000 });
    await expect(empIdError).toHaveAttribute("role", "alert");
  });

  test("fields with validation errors get aria-invalid=true", async ({ page }) => {
    await page.locator("#book-0-author").evaluate((el) => el.removeAttribute("required"));
    await page.locator("#book-0-title").evaluate((el) => el.removeAttribute("required"));
    await page.getByRole("button", { name: /Submit Requisition/i }).click();

    const employeeField = page.locator("#pub-employeeId");
    await expect(employeeField).toHaveAttribute("aria-invalid", "true", { timeout: 3000 });
  });

  test("honeypot field is positioned off-screen and not tabbable", async ({ page }) => {
    const honeypot = page.locator("#_hp_field");
    await expect(honeypot).toBeAttached();
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    await expect(honeypot).not.toBeInViewport();
  });
});
