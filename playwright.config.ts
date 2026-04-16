import { defineConfig } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "e2e", ".auth", "user.json");
const hasAuthCreds = !!(process.env.E2E_USERNAME && process.env.E2E_PASSWORD);
const hasAuthState = fs.existsSync(authFile);
const port = Number(process.env.PLAYWRIGHT_PORT ?? "3000");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER == null
    ? true
    : process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true";
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? `npm run dev -- --port ${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  outputDir: "./test-results",
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: webServerCommand,
    port,
    reuseExistingServer,
    timeout: 60_000,
  },
  projects: [
    // Auth setup — runs first, saves session state
    // Only runs when E2E_USERNAME and E2E_PASSWORD are set
    ...(hasAuthCreds
      ? [
          {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
          },
        ]
      : []),
    // Authenticated tests — require auth setup or existing auth state
    ...(hasAuthCreds || hasAuthState
      ? [
          {
            name: "authenticated",
            use: {
              browserName: "chromium" as const,
              storageState: authFile,
            },
            dependencies: hasAuthCreds ? ["setup"] : [],
            testMatch: [
              /admin\.spec\.ts/,
              /analytics\.spec\.ts/,
              /calendar\.spec\.ts/,
              /dashboard\.spec\.ts/,
              /dashboard-runtime-safety\.spec\.ts/,
              /invoices\.spec\.ts/,
              /logout\.spec\.ts/,
              /quotes\.spec\.ts/,
              /requisitions\.spec\.ts/,
              /requisition-authenticated\.spec\.ts/,
              /requisition-detail-workflow\.spec\.ts/,
              /staff\.spec\.ts/,
            ],
          },
        ]
      : []),
    // Unauthenticated tests — always run, no auth needed
    {
      name: "unauthenticated",
      use: { browserName: "chromium" },
      testMatch: [
        /auth\.spec\.ts/,
        /public-pages\.spec\.ts/,
        /requisition-api\.spec\.ts/,
        /requisition-api-comprehensive\.spec\.ts/,
        /requisition-public-submit\.spec\.ts/,
        /requisition-public-comprehensive\.spec\.ts/,
      ],
    },
  ],
});
