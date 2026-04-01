import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseReviewOutput } from "./codex-review-artifact.mjs";

function repoPaths() {
  const repoRoot = process.cwd();
  const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const resolvedGitDir = path.isAbsolute(gitDir) ? gitDir : path.resolve(repoRoot, gitDir);
  const liveDir = path.join(resolvedGitDir, "laportal");
  return {
    repoRoot,
    gitDir: resolvedGitDir,
    liveDir,
    liveLogPath: path.join(liveDir, "codex-review.live.log"),
    liveQueuePath: path.join(liveDir, "codex-review.live.jsonl"),
    liveStatePath: path.join(liveDir, "codex-review.live.json"),
    finalTextPath: path.join(liveDir, "codex-review.txt"),
    finalJsonPath: path.join(liveDir, "codex-review.json"),
  };
}

export function parseReviewArgs(argv) {
  const options = {
    passthrough: [],
    baseRef: "main",
    focusPaths: [],
  };

  let baseRefExplicit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const readValue = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    if (arg === "--base-ref") {
      options.baseRef = readValue();
      baseRefExplicit = true;
      options.passthrough.push(arg, options.baseRef);
      continue;
    }

    if (arg.startsWith("--base-ref=")) {
      options.baseRef = arg.slice("--base-ref=".length);
      baseRefExplicit = true;
      options.passthrough.push("--base-ref", options.baseRef);
      continue;
    }

    if (arg === "--focus") {
      const focusPath = readValue();
      options.focusPaths.push(focusPath);
      options.passthrough.push(arg, focusPath);
      continue;
    }

    if (arg.startsWith("--focus=")) {
      const focusPath = arg.slice("--focus=".length);
      options.focusPaths.push(focusPath);
      options.passthrough.push("--focus", focusPath);
      continue;
    }

    if (arg === "--json" || arg === "--help" || arg === "-h") {
      options.passthrough.push(arg);
      if (arg === "--json") {
        options.json = true;
      }
      continue;
    }

    if (!baseRefExplicit && options.baseRef === "main" && !arg.startsWith("--")) {
      options.baseRef = arg;
      baseRefExplicit = true;
      options.passthrough.push(arg);
      continue;
    }

    options.passthrough.push(arg);
  }

  return options;
}

function appendJsonLine(filePath, payload) {
  appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

function ensureLiveFiles(liveDir, liveLogPath, liveQueuePath, liveStatePath) {
  mkdirSync(liveDir, { recursive: true });
  writeFileSync(liveLogPath, "");
  writeFileSync(liveQueuePath, "");
  writeFileSync(liveStatePath, "");
}

export function normalizeFindingText(text) {
  return text
    .replace(/^LIVE-FINDING:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFinalFindingLine(line) {
  return line.startsWith("- ");
}

async function main() {
  const { repoRoot, liveDir, liveLogPath, liveQueuePath, liveStatePath, finalTextPath, finalJsonPath } =
    repoPaths();
  const args = parseReviewArgs(process.argv.slice(2));

  ensureLiveFiles(liveDir, liveLogPath, liveQueuePath, liveStatePath);

  const headShaValue = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

  appendJsonLine(liveQueuePath, {
    type: "review-start",
    headSha: headShaValue,
    baseRef: args.baseRef,
    focusPaths: args.focusPaths,
    createdAt: new Date().toISOString(),
  });

  const liveFindings = [];
  const startedAt = new Date().toISOString();
  const writeLiveSnapshot = (extra = {}) => {
    writeFileSync(
      liveStatePath,
      `${JSON.stringify(
        {
          headSha: headShaValue,
          baseRef: args.baseRef,
          focusPaths: args.focusPaths,
          createdAt: startedAt,
          startedAt,
          updatedAt: new Date().toISOString(),
          findings: liveFindings,
          liveFindings,
          result: extra.result ?? null,
          exitCode: extra.exitCode ?? null,
          finalTextPath: extra.finalTextPath ?? null,
          finalJsonPath: extra.finalJsonPath ?? null,
        },
        null,
        2,
      )}\n`,
    );
  };

  writeLiveSnapshot();

  const child = spawn(path.join(repoRoot, "scripts", "codex-review-local.sh"), args.passthrough, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const seenFindings = new Set();
  let streamBuffer = "";
  let finalParsed = null;

  const handleChunk = (chunk, source) => {
    const text = chunk.toString();
    appendFileSync(liveLogPath, text);
    process.stdout.write(text);

    streamBuffer += text;
    const lines = streamBuffer.split(/\r?\n/);
    streamBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("LIVE-FINDING:")) {
        const findingText = normalizeFindingText(line);
        if (!findingText || seenFindings.has(findingText)) {
          continue;
        }
        seenFindings.add(findingText);
        liveFindings.push({
          id: `L${liveFindings.length + 1}`,
          status: "unresolved",
          text: findingText,
          source,
        });
        writeLiveSnapshot();
        appendJsonLine(liveQueuePath, {
          type: "live-finding",
          source,
          headSha: headShaValue,
          createdAt: new Date().toISOString(),
          text: findingText,
        });
      }
    }
  };

  child.stdout.on("data", (chunk) => handleChunk(chunk, "stdout"));
  child.stderr.on("data", (chunk) => handleChunk(chunk, "stderr"));

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (streamBuffer.trim()) {
    appendFileSync(liveLogPath, streamBuffer);
    process.stdout.write(streamBuffer);
    for (const line of streamBuffer.split(/\r?\n/)) {
      if (line.startsWith("LIVE-FINDING:")) {
        const findingText = normalizeFindingText(line);
      if (findingText && !seenFindings.has(findingText)) {
        seenFindings.add(findingText);
        liveFindings.push({
          id: `L${liveFindings.length + 1}`,
          status: "unresolved",
          text: findingText,
          source: "tail",
        });
        writeLiveSnapshot();
        appendJsonLine(liveQueuePath, {
          type: "live-finding",
          source: "tail",
            headSha: headShaValue,
            createdAt: new Date().toISOString(),
            text: findingText,
          });
        }
      }
    }
  }

  if (existsSync(finalTextPath)) {
    const finalText = readFileSync(finalTextPath, "utf8");
    try {
      finalParsed = parseReviewOutput(finalText);
    } catch {
      finalParsed = null;
    }
  }

  if (finalParsed?.findings?.length) {
    for (const finding of finalParsed.findings) {
      const text = finding.text.trim();
      if (!text || seenFindings.has(text)) {
        continue;
      }
      seenFindings.add(text);
      liveFindings.push({
        id: finding.id,
        status: finding.status ?? "unresolved",
        text,
        source: "final",
      });
      writeLiveSnapshot({ result: finalParsed.result, exitCode });
      appendJsonLine(liveQueuePath, {
        type: "final-finding",
        headSha: headShaValue,
        createdAt: new Date().toISOString(),
        id: finding.id,
        text,
      });
    }
  }

  appendJsonLine(liveQueuePath, {
    type: "review-complete",
    headSha: headShaValue,
    createdAt: new Date().toISOString(),
    exitCode,
    result: finalParsed?.result ?? null,
    finalTextPath: existsSync(finalTextPath) ? finalTextPath : null,
    finalJsonPath: existsSync(finalJsonPath) ? finalJsonPath : null,
  });

  writeLiveSnapshot({
    result: finalParsed?.result ?? null,
    exitCode,
    finalTextPath: existsSync(finalTextPath) ? finalTextPath : null,
    finalJsonPath: existsSync(finalJsonPath) ? finalJsonPath : null,
  });

  process.exitCode = typeof exitCode === "number" ? exitCode : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
