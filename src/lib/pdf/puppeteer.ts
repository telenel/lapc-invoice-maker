import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium";

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "laportal-pdf-"));
  const inputPath = path.join(tempDir, "document.html");
  const outputPath = path.join(tempDir, "document.pdf");
  const configDir = path.join(tempDir, "config");
  const cacheDir = path.join(tempDir, "cache");

  try {
    await mkdir(configDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(inputPath, html, "utf8");

    await execFileAsync(
      CHROMIUM_PATH,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--print-to-pdf-no-header",
        `--print-to-pdf=${outputPath}`,
        `file://${inputPath}`,
      ],
      {
        env: {
          ...process.env,
          HOME: tempDir,
          XDG_CONFIG_HOME: configDir,
          XDG_CACHE_HOME: cacheDir,
        },
        timeout: 30_000,
      },
    );

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
