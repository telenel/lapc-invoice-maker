import { test, expect } from "@playwright/test";

test.describe("Staff Directory", () => {
  function addStaffButton(page: Parameters<typeof test>[0]["page"]) {
    return page
      .locator("main button")
      .filter({ hasText: "Add Staff Member" })
      .first();
  }

  test("list page loads with heading", async ({ page }) => {
    await page.goto("/staff");

    await expect(
      page.getByRole("heading", { name: /Staff Directory/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("staff table renders", async ({ page }) => {
    await page.goto("/staff");

    await expect(
      page
        .getByRole("table")
        .or(page.getByText(/No staff members yet|No staff members match your search/i)),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("search filters the staff list", async ({ page }) => {
    await page.goto("/staff");
    await expect(
      page
        .getByRole("table")
        .or(page.getByText(/No staff members yet|No staff members match your search/i)),
    ).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill("nonexistent-name-xyz");
    await expect(
      page.getByText(/No staff members match your search/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("add staff button is present", async ({ page }) => {
    await page.goto("/staff");

    await expect(addStaffButton(page)).toBeVisible({ timeout: 10_000 });
  });

  test("regular users can add and edit staff", async ({ page }) => {
    await page.goto("/staff");

    const suffix = Date.now().toString().slice(-6);
    const name = `E2E Staff ${suffix}`;
    const updatedTitle = `Program Specialist ${suffix}`;

    await addStaffButton(page).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Staff Member" })).toBeVisible();
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Title").fill("Program Assistant");
    await dialog.getByLabel("Department").fill(`E2E Department ${suffix}`);
    await dialog.getByLabel("Email").fill(`e2e-staff-${suffix}@example.com`);
    await dialog.getByRole("button", { name: "Add Staff Member", exact: true }).click();

    await expect(page.getByText(/Staff member created/i)).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder("Search staff…");
    await searchInput.fill(name);

    const row = page.getByRole("row", { name: new RegExp(name, "i") }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.locator("button[aria-label='Edit staff member']").click();

    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit Staff Member" })).toBeVisible();
    await editDialog.getByLabel("Title").fill(updatedTitle);
    await editDialog.getByRole("button", { name: "Save Changes", exact: true }).click();

    await expect(page.getByText(/Staff member updated/i)).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(updatedTitle);
  });
});
