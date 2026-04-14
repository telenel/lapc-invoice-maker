import { access } from "node:fs/promises";
import puppeteer from "puppeteer";

function chromiumCandidates(): string[] {
  return Array.from(new Set([
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value))));
}

async function resolveChromiumExecutable(): Promise<string | undefined> {
  for (const executablePath of chromiumCandidates()) {
    try {
      await access(executablePath);
      return executablePath;
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveChromiumExecutable(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    timeout: 30_000,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
