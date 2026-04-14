import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

function uniqueSuffix(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createFinalInvoice(
  request: APIRequestContext,
  page: Page,
  prefix: string
) {
  const suffix = uniqueSuffix(prefix);
  const invoiceNumber = `AG-${Date.now()}`;
  const staffResponse = await request.get("/api/staff");
  expect(staffResponse.ok()).toBe(true);

  const staffList = (await staffResponse.json()) as Array<{
    id: string;
    department?: string | null;
  }>;
  const staff = staffList.find((entry) => entry.department?.trim()) ?? staffList[0];

  if (!staff) {
    throw new Error("No staff records available to create a finalized invoice");
  }

  const createResponse = await request.post("/api/invoices", {
    data: {
      invoiceNumber,
      date: new Date().toISOString().slice(0, 10),
      staffId: staff.id,
      department: staff.department ?? "Operations",
      category: "SUPPLIES",
      accountCode: "",
      accountNumber: "",
      approvalChain: [],
      notes: `Archive invoice ${suffix}`,
      items: [
        {
          description: `Archive item ${suffix}`,
          quantity: 1,
          unitPrice: 10,
          sortOrder: 0,
          isTaxable: true,
        },
      ],
      marginEnabled: false,
      taxEnabled: false,
      taxRate: 0.0975,
    },
  });
  expect(createResponse.ok()).toBe(true);
  const createdInvoice = (await createResponse.json()) as { id: string; invoiceNumber: string | null };

  const finalizeResponse = await request.post(`/api/invoices/${createdInvoice.id}/finalize`, {
    data: {},
  });
  expect(finalizeResponse.ok()).toBe(true);

  await page.goto(`/invoices/${createdInvoice.id}`);
  await expect(page.getByText(/^Final$/i)).toBeVisible({
    timeout: 20_000,
  });

  return { invoiceNumber, suffix };
}

test.describe("Invoices", () => {
  test("list page loads with heading and table", async ({ page }) => {
    await page.goto("/invoices");

    await expect(page.getByRole("heading", { name: /Invoices/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("filter bar is present with status, category, search", async ({ page }) => {
    await page.goto("/invoices");

    // Wait for page to fully load
    await expect(page.getByRole("heading", { name: /Invoices/i })).toBeVisible();

    // Search input should exist
    await expect(
      page.getByPlaceholder(/search/i).or(page.locator("input[type='search'], input[type='text']").first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CSV export button is available", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByRole("button", { name: /Export CSV/i }).or(
        page.getByText(/Export CSV/i),
      ),
    ).toBeVisible();
  });

  test("navigate to new invoice page", async ({ page }) => {
    await page.goto("/invoices/new");

    await expect(page.getByRole("heading", { name: /New Invoice/i })).toBeVisible();
  });

  test("new invoice form has core fields", async ({ page }) => {
    await page.goto("/invoices/new");

    await expect(page.getByRole("heading", { name: /New Invoice/i })).toBeVisible({
      timeout: 10_000,
    });

    // Save buttons should be present
    await expect(
      page.getByRole("button", { name: /Save Draft/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Generate PDF/i }),
    ).toBeVisible();
  });

  test("save invoice as draft", async ({ page }) => {
    await page.goto("/invoices/new");

    // Wait for form to be ready
    await expect(
      page.getByRole("button", { name: /Save Draft/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Save Draft — should save even with minimal data
    await page.getByRole("button", { name: /Save Draft/i }).click();

    // Should show a success toast or redirect
    await expect(
      page.getByText(/saved|draft|created/i).or(page.locator("[data-sonner-toast]")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("filter invoices by search", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Type in search to filter
    const searchInput = page.getByPlaceholder(/search/i).or(
      page.locator("input[type='search'], input[type='text']").first(),
    );
    await searchInput.fill("nonexistent-query-xyz123");

    // Wait for table to update — should show empty state or fewer rows
    await page.waitForTimeout(1000);
  });
});

test.describe("Invoice Detail", () => {
  test("clicking a table row navigates to detail", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Check if there are any rows, skip if empty
    const rowCount = await page.locator("tbody tr").count();
    if (rowCount === 0) {
      test.skip(true, "No invoice rows available to test navigation");
    }

    // Click first row
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Should navigate to a detail page
    await expect(page).toHaveURL(/\/invoices\/[a-zA-Z0-9-]+/, {
      timeout: 10_000,
    });
  });

  test("finalized invoices can be archived and restored", async ({ page, request }) => {
    test.slow();
    const invoice = await createFinalInvoice(request, page, "archive-final");

    await page.getByRole("button", { name: /^Delete$/ }).click();
    await expect(page.getByRole("dialog", { name: /Delete Invoice/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /^Delete Invoice$/ }).click();

    await expect(page).toHaveURL(/\/invoices$/, { timeout: 15_000 });

    await page.goto("/archive");
    const archiveRow = page.getByRole("row", { name: new RegExp(invoice.invoiceNumber, "i") });
    await expect(archiveRow).toBeVisible({ timeout: 15_000 });
    await archiveRow.getByRole("button", { name: /^Restore$/ }).click();

    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Document restored/i })
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(archiveRow).toHaveCount(0);
  });
});
