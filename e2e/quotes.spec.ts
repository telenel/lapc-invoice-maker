import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

function uniqueSuffix(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function idFromUrl(url: string) {
  const match = url.match(/\/quotes\/([a-z0-9-]+)(?:\/edit)?$/i) ?? url.match(/\/invoices\/([a-z0-9-]+)(?:\/edit)?$/i);
  if (!match) {
    throw new Error(`Could not extract record id from URL: ${url}`);
  }
  return match[1];
}

async function dismissDraftRecovery(page: Page) {
  const discardButton = page.getByRole("button", { name: "Discard" });
  if (await discardButton.isVisible().catch(() => false)) {
    await discardButton.click();
  }
}

async function createDraftQuote(page: Page, prefix: string) {
  const suffix = uniqueSuffix(prefix);

  await page.goto("/quotes/new");
  await dismissDraftRecovery(page);
  await expect(page.getByRole("heading", { name: /New Quote/i })).toBeVisible({ timeout: 15_000 });

  await page.locator("#recipientName").fill(`E2E ${suffix}`);
  await page.locator("#recipientEmail").fill(`${suffix}@example.com`);
  await page.locator("#recipientOrg").fill("Playwright QA");
  await page.locator("#quoteDepartment").fill(`Ops ${suffix}`);
  await page.locator("#quoteNotes").fill(`Initial note ${suffix}`);
  await page.getByText("Select category…", { exact: true }).click();
  await page.getByRole("option", { name: /Supplies/i }).click();
  await page.getByRole("combobox", { name: "Item description…" }).fill(`Workflow item ${suffix}`);
  await page.getByRole("combobox", { name: "Item description…" }).press("Tab");
  await page.getByRole("spinbutton", { name: /Line item 1 unit price/i }).fill("10");

  await page.getByRole("button", { name: /Save Quote/i }).click();
  await expect(page).toHaveURL(/\/quotes\/[a-z0-9-]+$/i, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^Mark as Sent$/ })).toBeVisible({
    timeout: 15_000,
  });

  return {
    id: idFromUrl(page.url()),
    suffix,
  };
}

async function closeShareDialogIfOpen(page: Page) {
  const shareDialog = page.getByRole("dialog", { name: /Share Quote Link/i });
  if (await shareDialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(shareDialog).toBeHidden({ timeout: 5_000 });
  }
}

async function markQuoteSent(page: Page) {
  await page.getByRole("button", { name: /^Mark as Sent$/ }).click();
  await expect(page.getByText(/^Sent$/)).toBeVisible({ timeout: 15_000 });
  await closeShareDialogIfOpen(page);
}

async function approveQuote(page: Page) {
  await page.getByRole("button", { name: /^Approve Manually$/ }).click();
  await expect(page.getByRole("dialog", { name: /Approve Quote Manually/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /^Approve Quote$/ }).click();
  await expect(page.getByText(/^Accepted$/)).toBeVisible({ timeout: 15_000 });
}

async function approveQuoteWithCheck(page: Page) {
  await page.getByRole("button", { name: /^Approve Manually$/ }).click();
  await expect(page.getByRole("dialog", { name: /Approve Quote Manually/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /^Check$/i }).click();
  await page.getByRole("button", { name: /^Approve Quote$/ }).click();
  await expect(page.getByText(/^Accepted$/)).toBeVisible({ timeout: 15_000 });
}

async function resolvePaymentDetails(page: Page, methodName = "Check") {
  await page.getByRole("button", { name: /^Resolve Payment Details$/ }).click();
  await expect(page.getByRole("dialog", { name: /Resolve Payment Details/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: new RegExp(`^${methodName}$`, "i") }).click();
  await page.getByRole("button", { name: /^Save Payment Details$/ }).click();
  await expect(page.getByRole("dialog", { name: /Resolve Payment Details/i })).toBeHidden({
    timeout: 15_000,
  });
}

async function declineQuote(page: Page) {
  await page.getByRole("button", { name: /More/i }).click();
  await page.getByRole("menuitem", { name: /^Decline$/ }).click();
  await expect(page.getByRole("dialog", { name: /Decline Quote/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /^Decline Quote$/ }).click();
  await expect(page.getByText(/^Declined$/)).toBeVisible({ timeout: 15_000 });
}

test.describe("Quotes", () => {
  test("list page loads with heading and new quote button", async ({ page }) => {
    await page.goto("/quotes");

    await expect(page.getByRole("heading", { name: /Quotes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /New Quote/i })).toBeVisible();
  });

  test("quotes table renders", async ({ page }) => {
    await page.goto("/quotes");

    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("navigate to new quote page", async ({ page }) => {
    await page.goto("/quotes");
    await page.getByRole("link", { name: /New Quote/i }).click();

    await expect(page).toHaveURL(/\/quotes\/new/);
    await expect(page.getByRole("heading", { name: /New Quote/i })).toBeVisible();
  });

  test("new quote form has core fields", async ({ page }) => {
    await page.goto("/quotes/new");

    await expect(page.getByRole("heading", { name: /New Quote/i })).toBeVisible({
      timeout: 10_000,
    });

    // Recipient fields
    await expect(page.locator("#recipientName")).toBeVisible();
    await expect(page.locator("#recipientEmail")).toBeVisible();

    // Date fields
    await expect(page.locator("#quoteDate")).toBeVisible();
    await expect(page.locator("#expirationDate")).toBeVisible();

    // Save button
    await expect(
      page.getByRole("button", { name: /Save Quote/i }),
    ).toBeVisible();
  });

  test("create a new quote", async ({ page }) => {
    await page.goto("/quotes/new");

    await expect(
      page.getByRole("button", { name: /Save Quote/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Fill recipient
    await page.locator("#recipientName").fill("E2E Test Client");
    await page.locator("#recipientEmail").fill("test@example.com");
    await page.locator("#recipientOrg").fill("Test Corp");

    // Fill notes
    await page.locator("#quoteNotes").fill("E2E test quote");

    // Save the quote
    await page.getByRole("button", { name: /Save Quote/i }).click();

    // Should redirect to quote detail or show success
    await expect(
      page.getByText(/saved|created|success/i).or(page.locator("[data-sonner-toast]")).or(
        page.locator("text=/Quote #/i"),
      ),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("clicking a table row navigates to detail", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    // Check if there are any rows, skip if empty
    const rowCount = await page.locator("tbody tr").count();
    if (rowCount === 0) {
      test.skip(true, "No quote rows available to test navigation");
    }

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page).toHaveURL(/\/quotes\/[a-zA-Z0-9-]+/, {
      timeout: 10_000,
    });
  });
});

test.describe("Quote Workflow Transitions", () => {
  test("draft quotes stay editable and can regenerate PDFs after editing", async ({ page, request }) => {
    test.slow();
    const quote = await createDraftQuote(page, "draft-edit");

    await expect(page.getByRole("button", { name: /^Mark as Sent$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Edit$/ })).toHaveAttribute(
      "href",
      `/quotes/${quote.id}/edit`,
    );

    await page.getByRole("link", { name: /^Edit$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}/edit$`), { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /Edit Quote/i })).toBeVisible();

    await page.locator("#quoteNotes").fill(`Edited note ${quote.suffix}`);
    await page.getByRole("button", { name: /Update Quote/i }).click();

    await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}$`), { timeout: 15_000 });
    await expect(page.getByText(`Edited note ${quote.suffix}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^Draft$/)).toBeVisible();

    await expect(page.getByRole("button", { name: /^Download \/ Regenerate PDF$/ })).toBeVisible();

    const pdfResponse = await request.get(`/api/quotes/${quote.id}/pdf`, {
      timeout: 45_000,
    });
    const pdfBuffer = await pdfResponse.body();

    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    expect(pdfBuffer.byteLength).toBeGreaterThan(0);
  });

  test("editing an accepted quote reopens it to draft", async ({ page }) => {
    const quote = await createDraftQuote(page, "accepted-reopen");

    await markQuoteSent(page);
    await approveQuoteWithCheck(page);

    await expect(page.getByRole("button", { name: /^Convert to Invoice$/ })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("link", { name: /^Edit$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}/edit$`), { timeout: 10_000 });

    await page.locator("#quoteNotes").fill(`Reopened after approval ${quote.suffix}`);
    await page.getByRole("button", { name: /Update Quote/i }).click();

    await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}$`), { timeout: 15_000 });
    await expect(page.getByText(/^Draft$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Mark as Sent$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Convert to Invoice$/ })).toHaveCount(0);
  });

  test("declined quotes can be revised into a new draft", async ({ page }) => {
    const original = await createDraftQuote(page, "decline-revise");

    await markQuoteSent(page);
    await declineQuote(page);

    await expect(page.getByRole("button", { name: /^Revise & Resubmit$/ })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /^Revise & Resubmit$/ }).click();

    await expect(page).toHaveURL(/\/quotes\/[a-z0-9-]+\/edit$/i, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Edit Quote/i })).toBeVisible();

    const revisedId = idFromUrl(page.url());
    expect(revisedId).not.toBe(original.id);
  });

  test("sent quotes can be marked delivered and stay actionable", async ({ page }) => {
    const quote = await createDraftQuote(page, "submitted-manual");

    await markQuoteSent(page);

    await page.getByRole("button", { name: /More/i }).click();
    await page.getByRole("menuitem", { name: /^Mark as Delivered$/ }).click();

    await expect(page.getByText(/^Sent \(Manual\)$/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^Approve Manually$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Share Link$/ })).toBeVisible();

    await page.getByRole("button", { name: /More/i }).click();
    await expect(page.getByRole("menuitem", { name: /^Edit$/ })).toBeVisible();
    await page.getByRole("menuitem", { name: /^Edit$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}/edit$`), { timeout: 10_000 });
  });

  test("accepted quotes require resolved payment details before conversion", async ({ page }) => {
    await createDraftQuote(page, "resolve-payment");

    await markQuoteSent(page);
    await approveQuote(page);

    await expect(page.getByRole("button", { name: /^Resolve Payment Details$/ })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /^Convert to Invoice$/ })).toHaveCount(0);

    await resolvePaymentDetails(page);

    await expect(page.getByRole("button", { name: /^Convert to Invoice$/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("accepted quotes convert into editable draft invoices", async ({ page }) => {
    await createDraftQuote(page, "convert-invoice");

    await markQuoteSent(page);
    await approveQuoteWithCheck(page);

    await page.getByRole("button", { name: /^Convert to Invoice$/ }).click();
    await expect(page).toHaveURL(/\/invoices\/[a-z0-9-]+\/edit$/i, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Edit Invoice/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save Draft$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Update$/ })).toBeVisible();
  });

  test("draft quotes can be deleted from the detail view", async ({ page }) => {
    await createDraftQuote(page, "delete-draft");

    await page.getByRole("button", { name: /More/i }).click();
    await page.getByRole("menuitem", { name: /^Delete$/ }).click();
    await expect(page.getByRole("dialog", { name: /Delete Quote/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /^Delete Quote$/ }).click();

    await expect(page).toHaveURL(/\/quotes$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Quotes/i })).toBeVisible();
  });
});

test.describe("Quote Public Review", () => {
  // Public routes don't need auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test("invalid share token shows not-found", async ({ page }) => {
    await page.goto("/quotes/review/00000000-0000-0000-0000-000000000000");

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 3_000 });

    // Wait for loading to finish, then check for error state
    await expect(
      page.getByRole("heading", { name: /Quote Not Found/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
