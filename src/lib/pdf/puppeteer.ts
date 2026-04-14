import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

function chromiumCandidates(): string[] {
  return Array.from(new Set([
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value))));
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "laportal-pdf-"));
  const inputPath = path.join(tempDir, "document.html");
  const outputPath = path.join(tempDir, "document.pdf");
  const profileDir = path.join(tempDir, "profile");
  const configDir = path.join(tempDir, "config");
  const cacheDir = path.join(tempDir, "cache");
  const errors: string[] = [];

  try {
    await mkdir(profileDir, { recursive: true });
    await mkdir(configDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(inputPath, html, "utf8");

    for (const executablePath of chromiumCandidates()) {
      try {
        await execFileAsync(
          executablePath,
          [
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-breakpad",
            "--user-data-dir=" + profileDir,
            "--print-to-pdf-no-header",
            `--print-to-pdf=${outputPath}`,
            `file://${inputPath}`,
          ],
          {
            env: {
              ...process.env,
              XDG_CONFIG_HOME: configDir,
              XDG_CACHE_HOME: cacheDir,
            },
            timeout: 30_000,
          },
        );

        return await readFile(outputPath);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        errors.push(`${executablePath}: ${detail}`);
      }
    }

    throw new Error(
      `Failed to render PDF with available Chromium executables. ${errors.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
