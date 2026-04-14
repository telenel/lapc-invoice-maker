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

function invoicesHeading(page: Parameters<typeof test>[0]["page"]) {
  return page.getByRole("heading", { name: "Invoices", exact: true });
}

function invoicesSurface(page: Parameters<typeof test>[0]["page"]) {
  return page
    .getByRole("table")
    .or(page.getByRole("heading", { name: "No invoices found", exact: true }));
}

test.describe("Invoices", () => {
  test("list page loads with heading and table", async ({ page }) => {
    await page.goto("/invoices");

    await expect(invoicesHeading(page)).toBeVisible();
    await expect(invoicesSurface(page)).toBeVisible({ timeout: 15_000 });
  });

  test("filter bar is present with status, category, search", async ({ page }) => {
    await page.goto("/invoices");

    await expect(invoicesHeading(page)).toBeVisible();

    await expect(
      page.getByPlaceholder("Search invoices…"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CSV export button is available", async ({ page }) => {
    await page.goto("/invoices");
    await expect(invoicesSurface(page)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /^Filters$/i }).click();

    await expect(
      page.getByRole("button", { name: /Export CSV/i }),
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
    const suffix = Date.now().toString().slice(-6);
    const staffName = `E2E Draft Staff ${suffix}`;
    const department = `E2E Draft Department ${suffix}`;

    const createStaffResponse = await page.request.post("/api/staff", {
      data: {
        name: staffName,
        title: "Program Assistant",
        department,
        email: `e2e-draft-${suffix}@example.com`,
      },
    });
    expect(createStaffResponse.ok()).toBeTruthy();

    await page.goto("/invoices/new");

    await expect(
      page.getByRole("button", { name: /Save Draft/i }),
    ).toBeVisible({ timeout: 10_000 });

    const requestorCombobox = page.getByPlaceholder("Search staff…");
    await requestorCombobox.fill(staffName);
    await page.getByRole("option", { name: new RegExp(staffName, "i") }).click();

    const categoryCombobox = page.getByPlaceholder("Search categories…");
    await categoryCombobox.focus();
    await categoryCombobox.press("ArrowDown");
    await categoryCombobox.press("Enter");

    const descriptionInput = page.getByPlaceholder("Item description…").first();
    await descriptionInput.fill(`E2E draft line item ${suffix}`);
    await descriptionInput.press("Tab");
    await page.getByLabel("Line item 1 unit price").fill("18.75");

    await page.getByRole("button", { name: /Save Draft/i }).click();

    await expect(page).toHaveURL(/\/invoices\/[a-zA-Z0-9-]+$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Draft Invoice", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("filter invoices by search", async ({ page }) => {
    await page.goto("/invoices");
    await expect(invoicesSurface(page)).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder("Search invoices…");
    await searchInput.fill("nonexistent-query-xyz123");
    await expect(
      page.getByRole("heading", { name: "No invoices found", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("running invoices preserve requestor and account details for non-admin users", async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-6);
    const staffName = `E2E Invoice Staff ${suffix}`;
    const department = `E2E Department ${suffix}`;
    const runningTitle = `E2E Running Invoice ${suffix}`;
    const accountNumber = `ACCT-${suffix}`;
    const accountDescription = `E2E account ${suffix}`;
    const lineItemDescription = `E2E line item ${suffix}`;

    await page.goto("/staff");
    await page
      .locator("main button")
      .filter({ hasText: "Add Staff Member" })
      .first()
      .click();

    const addStaffDialog = page.getByRole("dialog");
    await addStaffDialog.getByLabel("Name").fill(staffName);
    await addStaffDialog.getByLabel("Title").fill("Program Coordinator");
    await addStaffDialog.getByLabel("Department").fill(department);
    await addStaffDialog.getByLabel("Email").fill(`e2e-invoice-${suffix}@example.com`);
    await addStaffDialog.getByRole("button", { name: "Add Staff Member", exact: true }).click();
    await expect(page.getByText(/Staff member created/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/invoices/new");
    await expect(page.getByRole("heading", { name: /New Invoice/i })).toBeVisible({
      timeout: 10_000,
    });

    const requestorCombobox = page.getByPlaceholder("Search staff…");
    await requestorCombobox.fill(staffName);
    await page.getByRole("option", { name: new RegExp(staffName, "i") }).click();

    const categoryCombobox = page.getByPlaceholder("Search categories…");
    await categoryCombobox.focus();
    await categoryCombobox.press("ArrowDown");
    await categoryCombobox.press("Enter");

    await page.getByRole("checkbox", { name: /Running Invoice/i }).check();
    await page.getByPlaceholder("Title (e.g. Music Dept Fall 2026 Supplies)").fill(
      runningTitle,
    );

    const accountCombobox = page.getByPlaceholder("Search or add account number…");
    await accountCombobox.fill(accountNumber);
    await page.getByRole("option", { name: new RegExp(`Add new:\\s+${accountNumber}`, "i") }).click();
    await page.getByPlaceholder("Description for this account number…").fill(
      accountDescription,
    );
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/Account number saved/i)).toBeVisible({ timeout: 10_000 });

    const descriptionInput = page.getByPlaceholder("Item description…").first();
    await descriptionInput.fill(lineItemDescription);
    await descriptionInput.press("Tab");
    await page.getByLabel("Line item 1 unit price").fill("42.50");

    await page.getByRole("button", { name: /Save Running Invoice/i }).click();

    await expect(page.getByText(/Draft saved/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/invoices\/[a-zA-Z0-9-]+$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: runningTitle, exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page).toHaveURL(/\/invoices\/[a-zA-Z0-9-]+\/edit$/, { timeout: 10_000 });

    await expect(page.getByPlaceholder("Search staff…")).toHaveValue(staffName);
    await expect(page.getByPlaceholder("Search or add account number…")).toHaveValue(
      accountNumber,
    );
    await expect(
      page.getByPlaceholder("Title (e.g. Music Dept Fall 2026 Supplies)"),
    ).toHaveValue(runningTitle);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Running Invoices/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("link", {
        name: new RegExp(`${runningTitle}.*${staffName}.*${department}`, "i"),
      }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Invoice Detail", () => {
  test("clicking a table row navigates to detail", async ({ page }) => {
    await page.goto("/invoices");
    await expect(invoicesSurface(page)).toBeVisible({ timeout: 15_000 });

    const table = page.getByRole("table");
    const tableVisible = await table.isVisible().catch(() => false);
    test.skip(!tableVisible, "No invoice rows available to test navigation");

    const rowCount = await page.locator("tbody tr").count();
    test.skip(rowCount === 0, "No invoice rows available to test navigation");

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

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
