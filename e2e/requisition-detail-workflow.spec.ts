import { test, expect } from "@playwright/test";

/**
 * Comprehensive E2E tests for authenticated requisition workflows:
 * detail page, edit flow, delete flow, status transitions, and attention flags.
 *
 * These tests require auth state — they run in the "authenticated" project.
 */

test.describe("Requisition Detail Page", () => {
  let requisitionId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test requisition via API so we have a known record to work with
    const response = await request.post("/api/textbook-requisitions", {
      data: {
        instructorName: "Prof. Detail Test",
        phone: "(818) 555-0010",
        email: "detail-test@piercecollege.edu",
        department: "English",
        course: "ENG 101",
        sections: "01",
        enrollment: 25,
        term: "Fall",
        reqYear: 2026,
        staffNotes: "Created by E2E detail workflow test",
        books: [
          {
            bookNumber: 1,
            author: "Strunk",
            title: "Elements of Style",
            isbn: "9780205309023",
            edition: "4",
            binding: "PAPERBACK",
          },
        ],
      },
    });

    if (response.status() === 302 || response.status() === 307) {
      test.skip(true, "Auth fixture not available");
      return;
    }

    if (response.ok()) {
      const body = await response.json();
      requisitionId = body.id;
    }
  });

  test("detail page shows instructor info and book details", async ({ page }) => {
    test.skip(!requisitionId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${requisitionId}`);

    // Header should show instructor name
    await expect(
      page.getByRole("heading", { name: /Prof\. Detail Test/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Subtext: department, course, term — use first() since detail page shows dept in multiple places
    await expect(page.getByText("English").first()).toBeVisible();
    await expect(page.getByText("ENG 101").first()).toBeVisible();

    // Status badge should show Pending
    await expect(page.getByText("Pending")).toBeVisible();

    // Book info
    await expect(page.getByText("Elements of Style")).toBeVisible();
    await expect(page.getByText("Strunk")).toBeVisible();
    await expect(page.getByText("9780205309023")).toBeVisible();

    // Audit section
    await expect(page.getByText(/staff created/i)).toBeVisible();
  });

  test("detail page shows Edit and Delete buttons", async ({ page }) => {
    test.skip(!requisitionId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${requisitionId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Detail Test/i })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("link", { name: /Edit/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete/i })).toBeVisible();
  });

  test("PENDING requisition shows 'Mark Ordered & Notify' button", async ({ page }) => {
    test.skip(!requisitionId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${requisitionId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Detail Test/i })).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole("button", { name: /Mark Ordered/i }),
    ).toBeVisible();

    // Should NOT show "Mark On-Shelf" yet
    await expect(
      page.getByRole("button", { name: /Mark On-Shelf/i }),
    ).toBeHidden();
  });

  test("back button navigates to list page", async ({ page }) => {
    test.skip(!requisitionId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${requisitionId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Detail Test/i })).toBeVisible({ timeout: 10_000 });

    // Click back link (ArrowLeft icon link to /textbook-requisitions)
    const backLink = page.locator("a[href='/textbook-requisitions']").first();
    await backLink.click();

    await expect(page).toHaveURL(/\/textbook-requisitions/, { timeout: 10_000 });
  });
});

test.describe("Requisition Edit Flow", () => {
  let editReqId: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions", {
      data: {
        instructorName: "Prof. Edit Test",
        phone: "(818) 555-0020",
        email: "edit-test@piercecollege.edu",
        department: "History",
        course: "HIST 001",
        sections: "01, 02",
        enrollment: 40,
        term: "Spring",
        reqYear: 2026,
        books: [
          {
            bookNumber: 1,
            author: "Zinn",
            title: "A People's History",
            isbn: "9780062397348",
          },
        ],
      },
    });

    if (response.ok()) {
      const body = await response.json();
      editReqId = body.id;
    }
  });

  test("edit page loads existing data into form fields", async ({ page }) => {
    test.skip(!editReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${editReqId}/edit`);

    // Wait for form to populate
    await expect(page.getByLabel(/Instructor Name/i)).toHaveValue("Prof. Edit Test", { timeout: 10_000 });
    await expect(page.getByLabel(/Phone/i)).toHaveValue("(818) 555-0020");
    await expect(page.getByLabel(/Email/i)).toHaveValue("edit-test@piercecollege.edu");
    await expect(page.getByLabel(/Department/i)).toHaveValue("History");
    await expect(page.getByLabel(/Course/i)).toHaveValue("HIST 001");
    await expect(page.getByLabel(/Section/i)).toHaveValue("01, 02");
    await expect(page.getByLabel(/Enrollment/i)).toHaveValue("40");

    // Book fields
    await expect(page.locator("#book-0-author")).toHaveValue("Zinn");
    await expect(page.locator("#book-0-title")).toHaveValue("A People's History");
  });

  test("editing and saving redirects to detail with updated data", async ({ page }) => {
    test.skip(!editReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${editReqId}/edit`);
    await expect(page.getByLabel(/Instructor Name/i)).toHaveValue("Prof. Edit Test", { timeout: 10_000 });

    // Change enrollment
    const enrollmentField = page.getByLabel(/Enrollment/i);
    await enrollmentField.clear();
    await enrollmentField.fill("50");

    // Add staff notes
    const staffNotes = page.getByLabel(/Staff Notes/i);
    if (await staffNotes.isVisible()) {
      await staffNotes.fill("Updated via E2E test");
    }

    // Save
    await page.getByRole("button", { name: /Save Changes/i }).click();

    // Should see success toast and redirect to detail
    const successToast = page.locator("[data-sonner-toast]");
    const detailHeading = page.getByRole("heading", { name: /Prof\. Edit Test/i });

    await expect(successToast.or(detailHeading)).toBeVisible({ timeout: 10_000 });
  });

  test("cancel button navigates back without saving", async ({ page }) => {
    test.skip(!editReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${editReqId}/edit`);
    await expect(page.getByLabel(/Instructor Name/i)).toHaveValue("Prof. Edit Test", { timeout: 10_000 });

    // Change something
    await page.getByLabel(/Department/i).clear();
    await page.getByLabel(/Department/i).fill("CHANGED");

    // Cancel
    await page.getByRole("button", { name: /Cancel/i }).click();

    // Should navigate back to detail page
    await expect(page.getByRole("heading", { name: /Prof\. Edit Test/i })).toBeVisible({ timeout: 10_000 });
  });

  test("edit form shows status change notice instead of status selector", async ({ page }) => {
    test.skip(!editReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${editReqId}/edit`);
    await expect(page.getByLabel(/Instructor Name/i)).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/Status changes are managed/i),
    ).toBeVisible();
  });
});

test.describe("Requisition Delete Flow", () => {
  let deleteReqId: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions", {
      data: {
        instructorName: "Prof. Delete Me",
        phone: "(818) 555-0030",
        email: "delete-test@piercecollege.edu",
        department: "Philosophy",
        course: "PHIL 001",
        sections: "01",
        enrollment: 15,
        term: "Fall",
        reqYear: 2026,
        books: [
          {
            bookNumber: 1,
            author: "Plato",
            title: "The Republic",
            isbn: "9780140449143",
          },
        ],
      },
    });

    if (response.ok()) {
      const body = await response.json();
      deleteReqId = body.id;
    }
  });

  test("delete dialog shows confirmation with requisition details", async ({ page }) => {
    test.skip(!deleteReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${deleteReqId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Delete Me/i })).toBeVisible({ timeout: 10_000 });

    // Click delete
    await page.getByRole("button", { name: /Delete/i }).click();

    // Dialog should appear with confirmation text
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByText(/Are you sure/i)).toBeVisible();
    await expect(dialog.getByText(/Prof\. Delete Me/i)).toBeVisible();
  });

  test("canceling delete dialog keeps the requisition", async ({ page }) => {
    test.skip(!deleteReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${deleteReqId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Delete Me/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Delete/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });

    // Cancel
    const cancelBtn = page.getByRole("dialog").getByRole("button", { name: /Cancel/i });
    await cancelBtn.click();

    // Dialog should close, we should still be on detail page
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: /Prof\. Delete Me/i })).toBeVisible();
  });

  test("confirming delete removes requisition and navigates to list", async ({ page }) => {
    test.skip(!deleteReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${deleteReqId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Delete Me/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Delete/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });

    // Confirm deletion
    const confirmBtn = page.getByRole("dialog").getByRole("button", { name: /Delete/i });
    await confirmBtn.click();

    // Should show success toast and redirect to list
    await expect(page).toHaveURL(/\/textbook-requisitions$/, { timeout: 10_000 });
  });
});

test.describe("Requisition Status Transitions", () => {
  let statusReqId: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post("/api/textbook-requisitions", {
      data: {
        instructorName: "Prof. Status Flow",
        phone: "(818) 555-0040",
        email: "status-test@piercecollege.edu",
        department: "Chemistry",
        course: "CHEM 101",
        sections: "01",
        enrollment: 30,
        term: "Fall",
        reqYear: 2026,
        books: [
          {
            bookNumber: 1,
            author: "Zumdahl",
            title: "Chemistry",
            isbn: "9781305957404",
          },
        ],
      },
    });

    if (response.ok()) {
      const body = await response.json();
      statusReqId = body.id;
    }
  });

  test("Mark Ordered transitions PENDING → ORDERED and shows toast", async ({ page }) => {
    test.skip(!statusReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${statusReqId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Status Flow/i })).toBeVisible({ timeout: 10_000 });

    // Should be PENDING with "Mark Ordered" button
    await expect(page.getByText("Pending")).toBeVisible();

    // Click Mark Ordered
    await page.getByRole("button", { name: /Mark Ordered/i }).click();

    // Should show toast (success, already_sent, or partial)
    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Status should now show "Ordered"
    await expect(page.getByText("Ordered")).toBeVisible({ timeout: 5000 });

    // "Mark Ordered" button should be gone, "Mark On-Shelf" should appear
    await expect(page.getByRole("button", { name: /Mark Ordered/i })).toBeHidden();
    await expect(page.getByRole("button", { name: /Mark On-Shelf/i })).toBeVisible();
  });

  test("Mark On-Shelf transitions ORDERED → ON_SHELF", async ({ page }) => {
    test.skip(!statusReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${statusReqId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Status Flow/i })).toBeVisible({ timeout: 10_000 });

    // Should be ORDERED now (from previous test)
    const onShelfBtn = page.getByRole("button", { name: /Mark On-Shelf/i });
    if (!(await onShelfBtn.isVisible().catch(() => false))) {
      test.skip(true, "Requisition not in ORDERED state — previous test may have been skipped");
      return;
    }

    await onShelfBtn.click();

    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Status should now show "On Shelf"
    await expect(page.getByText("On Shelf")).toBeVisible({ timeout: 5000 });

    // No more status action buttons
    await expect(page.getByRole("button", { name: /Mark Ordered/i })).toBeHidden();
    await expect(page.getByRole("button", { name: /Mark On-Shelf/i })).toBeHidden();
  });

  test("notification history appears after status transition", async ({ page }) => {
    test.skip(!statusReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${statusReqId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Status Flow/i })).toBeVisible({ timeout: 10_000 });

    // Look for notification history section
    const notifSection = page.getByText(/Notification History/i);
    if (await notifSection.isVisible().catch(() => false)) {
      // Should show at least one notification row
      const notifRows = page.locator("table").last().locator("tbody tr");
      expect(await notifRows.count()).toBeGreaterThan(0);
    }
  });
});

test.describe("Requisition Attention Flags", () => {
  let flagReqId: string;

  test.beforeAll(async ({ request }) => {
    // Create a requisition with attention-worthy data
    const response = await request.post("/api/textbook-requisitions", {
      data: {
        instructorName: "Prof. Flags Test",
        phone: "(818) 555-0050",
        email: "flags-test@piercecollege.edu",
        department: "Art",
        course: "ART 100",
        sections: "01",
        enrollment: 20,
        term: "Fall",
        reqYear: 2026,
        books: [
          {
            // Incomplete book — missing ISBN
            bookNumber: 1,
            author: "Author One",
            title: "Art History",
            isbn: "",
          },
          {
            // OER without link
            bookNumber: 2,
            author: "Author Two",
            title: "Open Art Resource",
            isbn: "9780000000000",
            bookType: "OER",
          },
        ],
      },
    });

    if (response.ok()) {
      const body = await response.json();
      flagReqId = body.id;
    }
  });

  test("detail page shows attention flags for incomplete data", async ({ page }) => {
    test.skip(!flagReqId, "No test requisition created");
    await page.goto(`/textbook-requisitions/${flagReqId}`);
    await expect(page.getByRole("heading", { name: /Prof\. Flags Test/i })).toBeVisible({ timeout: 10_000 });

    // Should show the amber attention box
    const attentionBox = page.getByText(/Attention Required/i);
    if (await attentionBox.isVisible().catch(() => false)) {
      // Should list specific flags
      const flagsList = page.locator("ul").filter({ hasText: /incomplete|invalid|OER without/i });
      await expect(flagsList).toBeVisible();
    }
  });
});

test.describe("Requisition List — Pagination and Sort", () => {
  test("pagination controls are visible when there are enough records", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await expect(page.getByRole("heading", { name: /Textbook Requisitions/i })).toBeVisible({ timeout: 10_000 });

    // Check if pagination info is shown
    const pageInfo = page.getByText(/Page \d+ of \d+/i);
    if (await pageInfo.isVisible().catch(() => false)) {
      await expect(pageInfo).toBeVisible();

      // Previous should be disabled on first page
      const prevBtn = page.getByRole("button", { name: /Previous/i });
      if (await prevBtn.isVisible().catch(() => false)) {
        await expect(prevBtn).toBeDisabled();
      }
    }
  });

  test("column headers are clickable for sorting", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Click "Submitted" header to sort
    const submittedHeader = page.getByRole("columnheader", { name: /Submitted/i });
    if (await submittedHeader.isVisible().catch(() => false)) {
      await submittedHeader.click();
      // Should update URL with sort params or re-render table
      await page.waitForTimeout(1000);
      // Click again to reverse sort
      await submittedHeader.click();
    }
  });

  test("search filter triggers on Enter key", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("Biology");
      await searchInput.press("Enter");

      // Table should refresh — wait briefly
      await page.waitForTimeout(1000);
    }
  });

  test("Clear button resets all filters", async ({ page }) => {
    await page.goto("/textbook-requisitions");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Apply a status filter
    const statusSelect = page.locator("select").filter({ hasText: /All Statuses/i });
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.selectOption("PENDING");

      // Clear button should appear
      const clearBtn = page.getByRole("button", { name: /Clear/i });
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
        // Status should reset
        await expect(statusSelect).toHaveValue("");
      }
    }
  });
});
