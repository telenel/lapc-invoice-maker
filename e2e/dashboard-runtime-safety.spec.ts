import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const repoRoot = path.resolve(__dirname, "..");
const envFiles = [".env.local", ".env"].map((name) => path.join(repoRoot, name));

function readEnvValue(name: string): string | null {
  for (const file of envFiles) {
    if (!fs.existsSync(file)) {
      continue;
    }

    for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const [key, ...rest] = line.split("=");
      if (key !== name) {
        continue;
      }

      return rest.join("=").trim();
    }
  }

  return null;
}

const realtimeUrl = readEnvValue("NEXT_PUBLIC_SUPABASE_URL");
const hasUsableRealtimeEnv =
  Boolean(realtimeUrl) &&
  !realtimeUrl!.includes("your-project-ref.supabase.co");

function runRepoScript(source: string) {
  execFileSync(
    "node",
    [
      "--env-file=.env",
      "--env-file=.env.local",
      "--input-type=module",
      "--import",
      "tsx",
      "-e",
      source,
    ],
    {
      cwd: repoRoot,
      stdio: "pipe",
    },
  );
}

function createTestNotification(title: string) {
  runRepoScript(`
    const { Client } = await import("pg");
    const { randomUUID } = await import("node:crypto");

    const username = process.env.E2E_USERNAME;
    const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
    if (!username) {
      throw new Error("E2E_USERNAME is required");
    }
    if (!connectionString) {
      throw new Error("DATABASE_URL or DIRECT_URL is required");
    }

    const client = new Client({ connectionString });
    await client.connect();
    const createdAt = new Date().toISOString();
    const notificationId = randomUUID();

    const userResult = await client.query(
      'select id from users where username = $1 limit 1',
      [username],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      await client.end();
      throw new Error(\`User not found for \${username}\`);
    }

    await client.query(
      \`insert into notifications (id, user_id, type, title, message, read, created_at)
       values ($1, $2, $3, $4, $5, false, $6)\`,
      [
        notificationId,
        userId,
        "EVENT_REMINDER",
        ${JSON.stringify(title)},
        "Dashboard runtime safety verification",
        createdAt,
      ],
    );

    await client.end();
  `);
}

function broadcastInvoiceChanged() {
  runRepoScript(`
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("Supabase realtime env is required");
    }
    const response = await fetch(\`\${url}/realtime/v1/api/broadcast\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: "app:global",
            event: "message",
            payload: { type: "invoice-changed" },
            private: true,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(\`Broadcast failed with status \${response.status}\`);
    }
  `);
}

async function ensureDragMode(page: Page) {
  await page.locator("body").click({ position: { x: 24, y: 24 } });
  await expect(
    page.getByLabel(/Drag to reorder/i).first(),
  ).toBeVisible({ timeout: 10_000 });
}

async function resetLayoutIfNeeded(page: Page) {
  const resetButton = page.getByRole("button", { name: /Reset dashboard to default layout/i });
  if (await resetButton.isVisible().catch(() => false)) {
    await resetButton.click();
  }
}

async function getWidgetY(page: Page, label: string) {
  const locator = page.getByText(label, { exact: true }).first();
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Could not read position for widget ${label}`);
  }
  return box.y;
}

test.describe.serial("Dashboard Runtime Safety", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("notifications still open, load newly created items, and dismiss", async ({ page }) => {
    const bell = page.getByRole("button", { name: /Notifications/i });
    await expect(bell).toBeVisible();

    const title = `Runtime Safety ${Date.now()}`;
    createTestNotification(title);
    await page.reload();
    await expect(bell).toBeVisible();

    await bell.click();
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 });

    const dismissButton = page.getByRole("button", {
      name: new RegExp(`Dismiss notification: ${title}`),
    });
    await dismissButton.click();
    await expect(page.getByText(title, { exact: true })).toBeHidden({ timeout: 15_000 });

    await page.locator("body").click({ position: { x: 12, y: 12 } });
    await expect(page.getByText("Notifications", { exact: true })).toBeHidden();
  });

  test("dashboard widgets still refetch after deferred realtime setup", async ({ page }) => {
    test.skip(!hasUsableRealtimeEnv, "Local Supabase realtime URL is still a placeholder, so end-to-end broadcast verification is not possible here.");

    await ensureDragMode(page);
    await page.waitForTimeout(1500);

    const refreshPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.status() === 200 &&
        response.url().includes("/api/invoices?") &&
        response.url().includes("statsOnly=true"),
      { timeout: 15_000 },
    );

    broadcastInvoiceChanged();

    const response = await refreshPromise;
    expect(response.url()).toContain("/api/invoices?");
  });

  test("drag-and-drop layout order still persists across reloads", async ({ page }) => {
    await ensureDragMode(page);
    await resetLayoutIfNeeded(page);

    const beforeTodayY = await getWidgetY(page, "Today's Events");
    const beforeFocusY = await getWidgetY(page, "Your Focus");
    expect(beforeTodayY).toBeLessThan(beforeFocusY);

    const source = page.getByLabel("Drag to reorder Today's Events");
    const target = page.getByText("Your Focus", { exact: true }).first();
    await source.dragTo(target, { force: true });

    await expect
      .poll(async () => {
        const todayY = await getWidgetY(page, "Today's Events");
        const focusY = await getWidgetY(page, "Your Focus");
        return todayY > focusY;
      })
      .toBe(true);

    await page.reload();
    await ensureDragMode(page);

    const persistedTodayY = await getWidgetY(page, "Today's Events");
    const persistedFocusY = await getWidgetY(page, "Your Focus");
    expect(persistedTodayY).toBeGreaterThan(persistedFocusY);

    const resetButton = page.getByRole("button", { name: /Reset dashboard to default layout/i });
    await resetButton.click();
  });
});
