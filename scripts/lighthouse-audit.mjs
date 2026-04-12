import fs from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import dotenv from "dotenv";
import lighthouse from "lighthouse";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);

for (const envFile of [".env.local", ".env"]) {
  dotenv.config({
    path: path.join(process.cwd(), envFile),
    override: false,
    quiet: true,
  });
}

const DEFAULT_BASE_URL = process.env.LIGHTHOUSE_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "playwright-report", "lighthouse");
const DEFAULT_SERVER_COMMAND = process.env.LIGHTHOUSE_WEB_SERVER_COMMAND || "npm run dev";
const DEFAULT_MANIFEST_PATH = path.join(process.cwd(), "scripts", "lighthouse-routes.json");
const ALL_CATEGORIES = ["performance", "accessibility", "best-practices"];
const SUMMARY_AUDITS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "speed-index",
  "total-blocking-time",
  "cumulative-layout-shift",
  "interactive",
  "server-response-time",
];
const AUDIT_LABELS = {
  "first-contentful-paint": "First Contentful Paint",
  "largest-contentful-paint": "Largest Contentful Paint",
  "speed-index": "Speed Index",
  "total-blocking-time": "Total Blocking Time",
  "cumulative-layout-shift": "Cumulative Layout Shift",
  "interactive": "Time to Interactive",
  "server-response-time": "Server Response Time",
};
const THRESHOLD_LABELS = {
  ...Object.fromEntries(ALL_CATEGORIES.map((category) => [category, category])),
  ...AUDIT_LABELS,
};

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    path: "/",
    url: "",
    browser: "chrome",
    preset: "desktop",
    outputDir: DEFAULT_OUTPUT_DIR,
    onlyCategories: ["performance"],
    headless: true,
    devtools: false,
    auth: false,
    chime: false,
    skipWarmup: false,
    startServer: true,
    serverCommand: DEFAULT_SERVER_COMMAND,
    runs: 1,
    manifest: DEFAULT_MANIFEST_PATH,
    routeSet: "",
    listRouteSets: false,
    ignoreThresholds: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--base-url") {
      args.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--path") {
      args.path = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--url") {
      args.url = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--browser") {
      args.browser = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--preset") {
      args.preset = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--output-dir") {
      args.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === "--only-categories") {
      args.onlyCategories = argv[index + 1]
        .split(",")
        .map((category) => category.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (value === "--all-categories") {
      args.onlyCategories = [...ALL_CATEGORIES];
      continue;
    }

    if (value === "--headed") {
      args.headless = false;
      continue;
    }

    if (value === "--devtools") {
      args.devtools = true;
      continue;
    }

    if (value === "--auth") {
      args.auth = true;
      continue;
    }

    if (value === "--chime") {
      args.chime = true;
      continue;
    }

    if (value === "--skip-warmup") {
      args.skipWarmup = true;
      continue;
    }

    if (value === "--no-start-server") {
      args.startServer = false;
      continue;
    }

    if (value === "--server-command") {
      args.serverCommand = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--runs") {
      args.runs = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (value === "--manifest") {
      args.manifest = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === "--route-set") {
      args.routeSet = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--list-route-sets") {
      args.listRouteSets = true;
      continue;
    }

    if (value === "--ignore-thresholds") {
      args.ignoreThresholds = true;
      continue;
    }

    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  npm run audit:perf -- --path /
  npm run audit:perf -- --path /analytics --auth
  npm run audit:perf:headed -- --path /admin/users --auth

Flags:
  --base-url <value>          Base URL for relative paths
  --path <value>              Route path, such as /analytics
  --url <value>               Full URL to audit
  --browser <chrome|chromium> Browser to launch
  --preset <desktop|mobile>   Lighthouse emulation preset
  --output-dir <path>         Directory for report files
  --only-categories <csv>     Categories to audit
  --all-categories            Run performance, accessibility, and best-practices
  --runs <number>             Repeat the audit and compute median scores/metrics
  --manifest <path>           Route manifest file for batch auditing
  --route-set <name>          Run a named route set from the manifest
  --list-route-sets           Print available route sets from the manifest
  --ignore-thresholds         Report threshold failures without exiting non-zero
  --auth                      Sign in before the audit using E2E_USERNAME/E2E_PASSWORD
  --headed                    Run with a visible browser window
  --devtools                  Open DevTools when headed
  --skip-warmup               Skip pre-audit navigation
  --no-start-server           Do not auto-start the local app server
  --server-command <value>    Override the local server command
  --chime                     Play a macOS system sound when the audit finishes
`);
}

function getTargetUrl({ url, baseUrl, path: routePath }) {
  if (url) {
    return url;
  }

  return new URL(routePath, baseUrl).toString();
}

function getRouteOutputName(route) {
  return route.id || slugifyUrl(route.url || route.path || "route");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-");
}

function slugifyUrl(targetUrl) {
  return targetUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function formatScore(score) {
  return typeof score === "number" ? Math.round(score * 100) : "n/a";
}

function formatMetricValue(id, value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  if (id === "cumulative-layout-shift") {
    return value.toFixed(3);
  }

  return `${Math.round(value)} ms`;
}

function collectRunSummary(lhr) {
  const scores = Object.fromEntries(
    ALL_CATEGORIES.map((category) => [category, lhr.categories[category]?.score ?? null]),
  );

  const metrics = Object.fromEntries(
    SUMMARY_AUDITS.map((auditId) => [auditId, lhr.audits[auditId]?.numericValue ?? null]),
  );

  return { scores, metrics };
}

function summarizeRuns(runSummaries) {
  const categorySummary = Object.fromEntries(
    ALL_CATEGORIES.map((category) => {
      const values = runSummaries
        .map((run) => run.scores[category])
        .filter((value) => typeof value === "number");

      return [
        category,
        values.length > 0
          ? {
              median: median(values),
              min: Math.min(...values),
              max: Math.max(...values),
            }
          : null,
      ];
    }),
  );

  const metricSummary = Object.fromEntries(
    SUMMARY_AUDITS.map((auditId) => {
      const values = runSummaries
        .map((run) => run.metrics[auditId])
        .filter((value) => typeof value === "number");

      return [
        auditId,
        values.length > 0
          ? {
              median: median(values),
              min: Math.min(...values),
              max: Math.max(...values),
            }
          : null,
      ];
    }),
  );

  return {
    runs: runSummaries.length,
    categories: categorySummary,
    metrics: metricSummary,
  };
}

function formatSummary(summary) {
  const lines = [`Median summary across ${summary.runs} run${summary.runs === 1 ? "" : "s"}:`];

  lines.push("Category scores:");
  for (const category of ALL_CATEGORIES) {
    const entry = summary.categories[category];
    lines.push(`- ${category}: ${entry ? formatScore(entry.median) : "n/a"}`);
  }

  lines.push("Key metrics:");
  for (const auditId of SUMMARY_AUDITS) {
    const entry = summary.metrics[auditId];
    lines.push(`- ${AUDIT_LABELS[auditId]}: ${entry ? formatMetricValue(auditId, entry.median) : "n/a"}`);
  }

  return lines.join("\n");
}

function formatBatchSummary(batchSummary) {
  const lines = [
    `Batch summary for route set "${batchSummary.routeSet}" (${batchSummary.routes.length} routes):`,
  ];

  for (const route of batchSummary.routes) {
    lines.push("");
    lines.push(`Route: ${route.id} (${route.path})${route.auth ? " [auth]" : ""} - ${route.thresholds?.passed === false ? "FAIL" : "PASS"}`);

    for (const category of ALL_CATEGORIES) {
      const entry = route.summary.categories[category];
      lines.push(`- ${category}: ${entry ? formatScore(entry.median) : "n/a"}`);
    }

    for (const auditId of SUMMARY_AUDITS) {
      const entry = route.summary.metrics[auditId];
      lines.push(`- ${AUDIT_LABELS[auditId]}: ${entry ? formatMetricValue(auditId, entry.median) : "n/a"}`);
    }

    if (route.thresholds && route.thresholds.failures.length > 0) {
      lines.push("- threshold failures:");
      for (const failure of route.thresholds.failures) {
        lines.push(`  - ${failure.label}: expected ${failure.expectation}, got ${failure.actual}`);
      }
    }
  }

  return lines.join("\n");
}

function evaluateThresholds(summary, thresholds = {}) {
  const failures = [];
  const categoryThresholds = thresholds.categories ?? {};
  const metricThresholds = thresholds.metrics ?? {};

  for (const [category, minimum] of Object.entries(categoryThresholds)) {
    const entry = summary.categories[category];
    const actualScore = entry?.median;
    const actualLabel = entry ? String(formatScore(actualScore)) : "n/a";

    if (!entry || typeof actualScore !== "number" || actualScore < minimum) {
      failures.push({
        type: "category",
        key: category,
        label: THRESHOLD_LABELS[category] ?? category,
        expectation: `>= ${Math.round(minimum * 100)}`,
        actual: actualLabel,
      });
    }
  }

  for (const [metricId, maximum] of Object.entries(metricThresholds)) {
    const entry = summary.metrics[metricId];
    const actualValue = entry?.median;
    const actualLabel = entry ? formatMetricValue(metricId, actualValue) : "n/a";

    if (!entry || typeof actualValue !== "number" || actualValue > maximum) {
      failures.push({
        type: "metric",
        key: metricId,
        label: THRESHOLD_LABELS[metricId] ?? metricId,
        expectation: `<= ${formatMetricValue(metricId, maximum)}`,
        actual: actualLabel,
      });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

function getDesktopConfig(onlyCategories) {
  return {
    extends: "lighthouse:default",
    settings: {
      onlyCategories,
      formFactor: "desktop",
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
    },
  };
}

function getMobileConfig(onlyCategories) {
  return {
    extends: "lighthouse:default",
    settings: {
      onlyCategories,
      formFactor: "mobile",
    },
  };
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Unable to allocate a debugging port."));
        return;
      }

      server.close(() => resolve(address.port));
    });

    server.on("error", reject);
  });
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

async function loadManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  if (!manifest.routeSets || typeof manifest.routeSets !== "object") {
    throw new Error(`Manifest at ${manifestPath} must contain a "routeSets" object.`);
  }

  return manifest;
}

function getRouteSet(manifest, routeSetName) {
  const routeSet = manifest.routeSets[routeSetName];

  if (!Array.isArray(routeSet)) {
    throw new Error(`Route set "${routeSetName}" was not found in the manifest.`);
  }

  return routeSet;
}

async function saveBatchSummary({ batchSummary, outputDir, reportBaseName }) {
  const jsonPath = path.join(outputDir, `${reportBaseName}.batch-summary.json`);
  const textPath = path.join(outputDir, `${reportBaseName}.batch-summary.txt`);

  await fs.writeFile(jsonPath, JSON.stringify(batchSummary, null, 2), "utf8");
  await fs.writeFile(textPath, formatBatchSummary(batchSummary), "utf8");

  return { jsonPath, textPath };
}

async function isUrlReachable(targetUrl) {
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(2_000),
    });

    return response.status > 0;
  } catch {
    return false;
  }
}

function isLocalUrl(targetUrl) {
  const parsed = new URL(targetUrl);
  return ["localhost", "127.0.0.1"].includes(parsed.hostname);
}

async function waitForUrl(targetUrl, timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isUrlReachable(targetUrl)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${targetUrl}`);
}

async function ensureServerReady(targetUrl, { enabled, command }) {
  if (!enabled || !isLocalUrl(targetUrl)) {
    return null;
  }

  if (await isUrlReachable(targetUrl)) {
    console.log(`Reusing running app server at ${targetUrl}`);
    return null;
  }

  console.log(`Starting app server with "${command}"`);

  const serverProcess = spawn(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: "ignore",
    env: process.env,
  });

  try {
    await waitForUrl(targetUrl);
    return serverProcess;
  } catch (error) {
    serverProcess.kill("SIGTERM");
    throw error;
  }
}

async function stopServer(serverProcess) {
  if (!serverProcess) {
    return;
  }

  await new Promise((resolve) => {
    serverProcess.once("exit", () => resolve());
    serverProcess.kill("SIGTERM");

    setTimeout(() => {
      serverProcess.kill("SIGKILL");
      resolve();
    }, 5_000).unref();
  });
}

async function playChimeIfRequested(enabled) {
  if (!enabled || process.platform !== "darwin") {
    return;
  }

  await execFileAsync("afplay", ["/System/Library/Sounds/Glass.aiff"]);
}

async function loginToLaportal(page, targetUrl) {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Authenticated audits require E2E_USERNAME and E2E_PASSWORD. " +
        "Store them in .env.local or pass them as environment variables.",
    );
  }

  const loginUrl = new URL("/login", targetUrl).toString();

  console.log(`Signing in at ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 60_000 });

  const loginResult = await page.evaluate(async ({ username: providedUsername, password: providedPassword }) => {
    const csrfResponse = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
    });
    const csrfText = await csrfResponse.text();
    let csrfToken;

    try {
      ({ csrfToken } = JSON.parse(csrfText));
    } catch {
      return {
        ok: false,
        status: csrfResponse.status,
        text: csrfText,
        stage: "csrf",
      };
    }

    const body = new URLSearchParams();
    body.set("csrfToken", csrfToken);
    body.set("username", providedUsername);
    body.set("password", providedPassword);
    body.set("rememberMe", "true");
    body.set("callbackUrl", "/");
    body.set("json", "true");

    const response = await fetch("/api/auth/callback/credentials?json=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      credentials: "same-origin",
      body: body.toString(),
    });

    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
      stage: "login",
    };
  }, { username, password });

  if (!loginResult.ok) {
    if (loginResult.stage === "csrf" && typeof loginResult.text === "string" && loginResult.text.includes("<!DOCTYPE")) {
      throw new Error(
        "The auth API returned HTML instead of JSON. " +
          "Local authenticated audits need the rest of LA Portal's runtime env configured, " +
          "such as the values from .env.example in a real .env or .env.local file.",
      );
    }

    throw new Error(`Login failed with status ${loginResult.status}.`);
  }

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });

  if (new URL(page.url()).pathname.startsWith("/login")) {
    throw new Error("Login did not create an authenticated session for the audit.");
  }
}

async function saveReports({ report, outputDir, reportBaseName }) {
  const htmlPath = path.join(outputDir, `${reportBaseName}.html`);
  const jsonPath = path.join(outputDir, `${reportBaseName}.json`);
  const reports = Array.isArray(report) ? report : [report];

  if (reports.length !== 2) {
    throw new Error("Unexpected Lighthouse output payload.");
  }

  await fs.writeFile(htmlPath, reports[0], "utf8");
  await fs.writeFile(jsonPath, reports[1], "utf8");

  return { htmlPath, jsonPath };
}

async function saveSummary({ summary, outputDir, reportBaseName }) {
  const jsonPath = path.join(outputDir, `${reportBaseName}.summary.json`);
  const textPath = path.join(outputDir, `${reportBaseName}.summary.txt`);

  await fs.writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  await fs.writeFile(textPath, formatSummary(summary), "utf8");

  return { jsonPath, textPath };
}

async function runAuditSuite({ args, outputDir, targetUrl, auth }) {
  const port = await findFreePort();
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "laportal-lighthouse-"));
  let context;

  try {
    const launchOptions = {
      headless: args.headless,
      devtools: args.devtools,
      args: [`--remote-debugging-port=${port}`],
    };

    if (args.browser === "chrome") {
      launchOptions.channel = "chrome";
    }

    context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    const existingPage = context.pages()[0];
    const page = existingPage ?? (await context.newPage());

    if (auth) {
      await loginToLaportal(page, targetUrl);
    }

    if (!args.skipWarmup) {
      console.log(`Warming up ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });
    }

    const config = args.preset === "desktop"
      ? getDesktopConfig(args.onlyCategories)
      : getMobileConfig(args.onlyCategories);
    const runSummaries = [];
    const runReportPaths = [];
    const suiteBaseName = `${slugifyUrl(targetUrl)}-${args.preset}-${timestamp()}`;

    await ensureDir(outputDir);

    for (let runIndex = 0; runIndex < args.runs; runIndex += 1) {
      const humanRunNumber = runIndex + 1;
      console.log(`Running Lighthouse on ${targetUrl} (run ${humanRunNumber}/${args.runs})`);

      const runnerResult = await lighthouse(
        targetUrl,
        {
          port,
          logLevel: "info",
          output: ["html", "json"],
          disableStorageReset: true,
          onlyCategories: args.onlyCategories,
        },
        config,
      );

      if (!runnerResult) {
        throw new Error("Lighthouse did not return a result.");
      }

      const reportBaseName = `${suiteBaseName}-run-${humanRunNumber}`;
      const reportPaths = await saveReports({
        report: runnerResult.report,
        outputDir,
        reportBaseName,
      });

      runSummaries.push(collectRunSummary(runnerResult.lhr));
      runReportPaths.push(reportPaths);
    }

    const summary = summarizeRuns(runSummaries);
    const summaryPaths = await saveSummary({
      summary,
      outputDir,
      reportBaseName: suiteBaseName,
    });

    console.log("");
    console.log(formatSummary(summary));
    console.log(`Latest HTML report: ${runReportPaths.at(-1)?.htmlPath ?? "n/a"}`);
    console.log(`Latest JSON report: ${runReportPaths.at(-1)?.jsonPath ?? "n/a"}`);
    console.log(`Summary JSON: ${summaryPaths.jsonPath}`);
    console.log(`Summary text: ${summaryPaths.textPath}`);

    return {
      summary,
      summaryPaths,
      runReportPaths,
      suiteBaseName,
    };
  } finally {
    await context?.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!["chrome", "chromium"].includes(args.browser)) {
    throw new Error(`Unsupported browser "${args.browser}". Use "chrome" or "chromium".`);
  }

  if (!["desktop", "mobile"].includes(args.preset)) {
    throw new Error(`Unsupported preset "${args.preset}". Use "desktop" or "mobile".`);
  }

  if (!Number.isInteger(args.runs) || args.runs < 1) {
    throw new Error("The --runs value must be an integer greater than or equal to 1.");
  }

  let shouldPlayChime = false;
  let serverProcess = null;

  try {
    if (args.listRouteSets) {
      const manifest = await loadManifest(args.manifest);
      console.log(Object.keys(manifest.routeSets).join("\n"));
      return;
    }

    await ensureDir(args.outputDir);

    if (args.routeSet) {
      const manifest = await loadManifest(args.manifest);
      const routes = getRouteSet(manifest, args.routeSet);
      const baseRoute = routes[0] ?? { path: "/" };
      const initialTargetUrl = getTargetUrl({
        baseUrl: args.baseUrl,
        path: baseRoute.path,
        url: baseRoute.url ?? "",
      });

      serverProcess = await ensureServerReady(initialTargetUrl, {
        enabled: args.startServer,
        command: args.serverCommand,
      });

      const batchRoutes = [];

      for (const route of routes) {
        const targetUrl = getTargetUrl({
          baseUrl: args.baseUrl,
          path: route.path,
          url: route.url ?? "",
        });
        const routeOutputDir = path.join(args.outputDir, getRouteOutputName(route));

        console.log("");
        console.log(`=== Route: ${route.id} (${route.path})${route.auth ? " [auth]" : ""} ===`);

        const result = await runAuditSuite({
          args,
          outputDir: routeOutputDir,
          targetUrl,
          auth: Boolean(route.auth),
        });
        const thresholdResult = evaluateThresholds(result.summary, route.thresholds);

        batchRoutes.push({
          id: route.id,
          path: route.path,
          auth: Boolean(route.auth),
          targetUrl,
          outputDir: routeOutputDir,
          summary: result.summary,
          thresholds: thresholdResult,
          latestHtmlReport: result.runReportPaths.at(-1)?.htmlPath ?? null,
          latestJsonReport: result.runReportPaths.at(-1)?.jsonPath ?? null,
          summaryJson: result.summaryPaths.jsonPath,
          summaryText: result.summaryPaths.textPath,
        });
      }

      const batchSummary = {
        routeSet: args.routeSet,
        manifest: args.manifest,
        generatedAt: new Date().toISOString(),
        runsPerRoute: args.runs,
        categories: args.onlyCategories,
        routes: batchRoutes,
      };
      batchSummary.failedRoutes = batchRoutes.filter((route) => route.thresholds?.passed === false).map((route) => route.id);
      batchSummary.passed = batchSummary.failedRoutes.length === 0;
      const batchBaseName = `route-set-${args.routeSet}-${timestamp()}`;
      const batchPaths = await saveBatchSummary({
        batchSummary,
        outputDir: args.outputDir,
        reportBaseName: batchBaseName,
      });

      console.log("");
      console.log(formatBatchSummary(batchSummary));
      console.log(`Batch summary JSON: ${batchPaths.jsonPath}`);
      console.log(`Batch summary text: ${batchPaths.textPath}`);
      shouldPlayChime = args.chime;

      if (!batchSummary.passed && !args.ignoreThresholds) {
        throw new Error(`Threshold checks failed for route set "${args.routeSet}": ${batchSummary.failedRoutes.join(", ")}`);
      }

      return;
    }

    const targetUrl = getTargetUrl(args);
    serverProcess = await ensureServerReady(targetUrl, {
      enabled: args.startServer,
      command: args.serverCommand,
    });

    await runAuditSuite({
      args,
      outputDir: args.outputDir,
      targetUrl,
      auth: args.auth,
    });
    shouldPlayChime = args.chime;
  } finally {
    await stopServer(serverProcess);
  }

  await playChimeIfRequested(shouldPlayChime);
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
