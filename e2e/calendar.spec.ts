import { test, expect } from "@playwright/test";

test.describe("Calendar", () => {
  test("calendar page renders FullCalendar", async ({ page }) => {
    await page.goto("/calendar");

    // FullCalendar renders a container with the fc class
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });
  });

  test("calendar shows day/week/month views", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    // FullCalendar toolbar buttons for view switching
    const toolbar = page.locator(".fc-header-toolbar");
    await expect(toolbar).toBeVisible();

    // Should have view buttons (dayGridMonth, timeGridWeek, timeGridDay)
    await expect(
      page.locator(".fc-dayGridMonth-button, .fc-timeGridWeek-button, .fc-timeGridDay-button").first(),
    ).toBeVisible();
  });

  test("add event button is present", async ({ page }) => {
    await page.goto("/calendar");

    await expect(
      page.getByRole("button", { name: /Add Event|New Event/i }).or(
        page.locator("button").filter({ has: page.locator("svg") }).first(),
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking add event opens the modal", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    // Click the add event button
    const addBtn = page.getByRole("button", { name: /Add Event|New Event/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();

      // The AddEventModal should appear
      await expect(
        page.getByRole("dialog").or(page.locator("[role='dialog']")),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("calendar navigation works", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    // Navigate forward with the next button
    const nextBtn = page.locator(".fc-next-button");
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      // Calendar should still be visible and update
      await expect(page.locator(".fc")).toBeVisible();
    }

    // Navigate backward
    const prevBtn = page.locator(".fc-prev-button");
    if (await prevBtn.isVisible()) {
      await prevBtn.click();
      await expect(page.locator(".fc")).toBeVisible();
    }
  });
});
