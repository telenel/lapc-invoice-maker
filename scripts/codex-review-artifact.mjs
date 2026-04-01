import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const HISTORY_LIMIT = 20;

function parseCliArgs(argv) {
  const options = {
    focusPaths: [],
    changedFiles: [],
    reviewedFiles: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const readValue = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    if (arg.startsWith("--template=")) {
      options.templatePath = arg.slice("--template=".length);
      continue;
    }

    if (arg.startsWith("--output=")) {
      options.outputPath = arg.slice("--output=".length);
      continue;
    }

    if (arg.startsWith("--text-report=")) {
      options.textReportPath = arg.slice("--text-report=".length);
      continue;
    }

    if (arg.startsWith("--json-report=")) {
      options.jsonReportPath = arg.slice("--json-report=".length);
      continue;
    }

    if (arg.startsWith("--history-dir=")) {
      options.historyDir = arg.slice("--history-dir=".length);
      continue;
    }

    if (arg.startsWith("--artifact=")) {
      options.artifactPath = arg.slice("--artifact=".length);
      continue;
    }

    if (arg.startsWith("--base-ref=")) {
      options.baseRef = arg.slice("--base-ref=".length);
      continue;
    }

    if (arg.startsWith("--head-sha=")) {
      options.headSha = arg.slice("--head-sha=".length);
      continue;
    }

    if (arg.startsWith("--created-at=")) {
      options.createdAt = arg.slice("--created-at=".length);
      continue;
    }

    switch (arg) {
      case "--template":
        options.templatePath = readValue();
        break;
      case "--output":
        options.outputPath = readValue();
        break;
      case "--text-report":
        options.textReportPath = readValue();
        break;
      case "--json-report":
        options.jsonReportPath = readValue();
        break;
      case "--history-dir":
        options.historyDir = readValue();
        break;
      case "--artifact":
        options.artifactPath = readValue();
        break;
      case "--base-ref":
        options.baseRef = readValue();
        break;
      case "--head-sha":
        options.headSha = readValue();
        break;
      case "--created-at":
        options.createdAt = readValue();
        break;
      case "--focus":
        options.focusPaths.push(readValue());
        break;
      case "--changed-file":
        options.changedFiles.push(readValue());
        break;
      case "--reviewed-file":
        options.reviewedFiles.push(readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function shellQuote(value) {
  if (value === "") {
    return "''";
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function toLines(items) {
  if (items.length === 0) {
    return ["- none"];
  }

  return items.map((item) => `- ${item}`);
}

export function buildRuntimePrompt({
  template,
  baseRef,
  headSha,
  focusPaths = [],
  changedFiles = [],
  reviewedFiles = [],
}) {
  const focusActive = focusPaths.length > 0;
  const diffScopeArgs = focusActive
    ? focusPaths.map((entry) => shellQuote(entry)).join(" ")
    : "";
  const diffScopeSuffix = focusActive ? ` -- ${diffScopeArgs}` : "";

  const sections = [
    template.trimEnd(),
    "",
    "Runtime review context for this invocation:",
    `- HEAD commit: ${headSha}`,
    `- Base ref: ${baseRef}`,
    focusActive
      ? "- Focused review mode: active. Review only the branch diff hunks that match the requested focus paths, but keep branch-relative context while reasoning."
      : "- Focused review mode: inactive. Review the complete branch diff relative to the base ref.",
    "- Requested focus paths:",
    ...toLines(focusPaths),
    "- All changed files in the branch diff:",
    ...toLines(changedFiles),
    "- Files currently in review scope for this run:",
    ...toLines(reviewedFiles),
    "",
    "Use these exact inspection commands for this invocation:",
    `- git log --oneline ${shellQuote(`${baseRef}...HEAD`)}`,
    `- git diff --stat ${shellQuote(`${baseRef}...HEAD`)}${diffScopeSuffix}`,
    `- git diff --unified=0 ${shellQuote(`${baseRef}...HEAD`)}${diffScopeSuffix}`,
    `- git diff --name-only ${shellQuote(`${baseRef}...HEAD`)}${diffScopeSuffix}`,
    "",
    "Your SCOPE section must name the concrete files, functions, and areas you actually inspected.",
  ];

  return `${sections.join("\n")}\n`;
}

function parseBulletSection(lines, startIndex) {
  const items = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^[A-Z][A-Z_]+:\s*/.test(line)) {
      return { items, nextIndex: index };
    }

    const bulletMatch = line.match(/^- (.+)$/);
    if (bulletMatch) {
      items.push(bulletMatch[1].trim());
      continue;
    }

    if (/^\s+/.test(line) && line.trim() !== "" && items.length > 0) {
      items[items.length - 1] = `${items[items.length - 1]} ${line.trim()}`;
    }
  }

  return { items, nextIndex: lines.length };
}

export function parseReviewOutput(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let result = "";
  let summary = "";
  let scopeItems = [];
  let findings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("RESULT:")) {
      result = line.slice("RESULT:".length).trim();
      continue;
    }

    if (line.startsWith("SUMMARY:")) {
      summary = line.slice("SUMMARY:".length).trim();
      continue;
    }

    if (line.trim() === "SCOPE:") {
      const parsed = parseBulletSection(lines, index + 1);
      scopeItems = parsed.items;
      index = parsed.nextIndex - 1;
      continue;
    }

    if (line.trim() === "FINDINGS:") {
      const parsed = parseBulletSection(lines, index + 1);
      findings = parsed.items;
      index = parsed.nextIndex - 1;
    }
  }

  if (!["PASS", "FAIL"].includes(result)) {
    throw new Error("Codex review output was missing a valid RESULT line.");
  }

  if (findings.length === 1 && findings[0].toLowerCase() === "none") {
    findings = [];
  }

  return {
    result,
    summary,
    scopeItems,
    findings,
  };
}

function unique(values) {
  return [...new Set(values)];
}

function deriveAreas(reviewedFiles) {
  return unique(
    reviewedFiles.map((filePath) => {
      const directory = path.dirname(filePath);
      return directory === "." ? "repo root" : directory;
    }),
  );
}

export function buildScopeSummary({ reviewedFiles, focusPaths, areas }) {
  const reviewCount = reviewedFiles.length;
  const areaCount = areas.length;
  const focusPrefix =
    focusPaths.length > 0 ? `Focused review of ${reviewCount} changed file${reviewCount === 1 ? "" : "s"}` : `Reviewed ${reviewCount} changed file${reviewCount === 1 ? "" : "s"}`;
  const areaSuffix =
    areaCount > 0
      ? ` across ${areas.slice(0, 3).join(", ")}${areaCount > 3 ? `, and ${areaCount - 3} more area${areaCount - 3 === 1 ? "" : "s"}` : ""}`
      : "";

  return `${focusPrefix}${areaSuffix}.`;
}

function toHistoryKey(createdAt, headSha) {
  return `codex-review-${createdAt.replace(/[^0-9TZ]/g, "")}-${headSha.slice(0, 12)}`;
}

function pruneHistory(historyDir) {
  const jsonEntries = readdirSync(historyDir)
    .filter((entry) => /^codex-review-.*\.json$/.test(entry))
    .sort()
    .reverse();

  const staleEntries = jsonEntries.slice(HISTORY_LIMIT);

  for (const jsonEntry of staleEntries) {
    const stem = jsonEntry.slice(0, -".json".length);
    rmSync(path.join(historyDir, `${stem}.json`), { force: true });
    rmSync(path.join(historyDir, `${stem}.txt`), { force: true });
  }
}

export function recordReviewArtifact({
  textReportPath,
  jsonReportPath,
  historyDir,
  headSha,
  baseRef,
  createdAt,
  focusPaths = [],
  changedFiles = [],
  reviewedFiles = [],
}) {
  const text = readFileSync(textReportPath, "utf8");
  const parsed = parseReviewOutput(text);
  const effectiveReviewedFiles = reviewedFiles.length > 0 ? reviewedFiles : changedFiles;
  const areas = deriveAreas(effectiveReviewedFiles);
  const historyKey = toHistoryKey(createdAt, headSha);
  const historyTextReportPath = path.join(historyDir, `${historyKey}.txt`);
  const historyJsonReportPath = path.join(historyDir, `${historyKey}.json`);
  const latestHistoryTextPath = path.join(historyDir, "latest.txt");
  const latestHistoryJsonPath = path.join(historyDir, "latest.json");

  mkdirSync(path.dirname(jsonReportPath), { recursive: true });
  mkdirSync(historyDir, { recursive: true });

  const artifact = {
    schemaVersion: 1,
    createdAt,
    headSha,
    baseRef,
    result: parsed.result,
    summary: parsed.summary,
    scope: {
      summary: buildScopeSummary({
        reviewedFiles: effectiveReviewedFiles,
        focusPaths,
        areas,
      }),
      focusPaths,
      changedFiles,
      reviewedFiles: effectiveReviewedFiles,
      areas,
      inspectedItems: parsed.scopeItems,
    },
    findings: parsed.findings.map((finding, index) => ({
      id: `F${index + 1}`,
      status: "unresolved",
      text: finding,
    })),
    artifacts: {
      latestTextReportPath: textReportPath,
      latestJsonReportPath: jsonReportPath,
      historyTextReportPath,
      historyJsonReportPath,
      latestHistoryTextPath,
      latestHistoryJsonPath,
    },
  };

  writeFileSync(jsonReportPath, `${JSON.stringify(artifact, null, 2)}\n`);
  copyFileSync(textReportPath, historyTextReportPath);
  copyFileSync(jsonReportPath, historyJsonReportPath);
  copyFileSync(textReportPath, latestHistoryTextPath);
  copyFileSync(jsonReportPath, latestHistoryJsonPath);
  pruneHistory(historyDir);

  return artifact;
}

export function formatLatestFindings(artifact) {
  const lines = [
    `Latest Codex review: ${artifact.result} for ${artifact.headSha} against ${artifact.baseRef} at ${artifact.createdAt}`,
    `Scope: ${artifact.scope.summary}`,
  ];

  const unresolvedFindings = (artifact.findings ?? []).filter(
    (finding) => finding.status !== "resolved",
  );

  if (unresolvedFindings.length === 0) {
    lines.push("No unresolved Codex findings in the latest artifact.");
    return lines.join("\n");
  }

  lines.push("Unresolved findings:");
  unresolvedFindings.forEach((finding, index) => {
    lines.push(`${index + 1}. ${finding.text}`);
  });

  return lines.join("\n");
}

function defaultArtifactPath() {
  const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], {
    encoding: "utf8",
  }).trim();

  return path.resolve(gitDir, "laportal", "codex-review.json");
}

function readArtifact(artifactPath) {
  if (!existsSync(artifactPath)) {
    throw new Error(`Latest Codex review artifact not found at ${artifactPath}`);
  }

  return JSON.parse(readFileSync(artifactPath, "utf8"));
}

function commandBuildPrompt(argv) {
  const options = parseCliArgs(argv);

  if (!options.templatePath || !options.outputPath || !options.baseRef || !options.headSha) {
    throw new Error("build-prompt requires --template, --output, --base-ref, and --head-sha");
  }

  const template = readFileSync(options.templatePath, "utf8");
  const prompt = buildRuntimePrompt({
    template,
    baseRef: options.baseRef,
    headSha: options.headSha,
    focusPaths: options.focusPaths,
    changedFiles: options.changedFiles,
    reviewedFiles: options.reviewedFiles,
  });

  writeFileSync(options.outputPath, prompt);
}

function commandRecord(argv) {
  const options = parseCliArgs(argv);

  if (
    !options.textReportPath ||
    !options.jsonReportPath ||
    !options.historyDir ||
    !options.headSha ||
    !options.baseRef ||
    !options.createdAt
  ) {
    throw new Error(
      "record requires --text-report, --json-report, --history-dir, --head-sha, --base-ref, and --created-at",
    );
  }

  recordReviewArtifact({
    textReportPath: options.textReportPath,
    jsonReportPath: options.jsonReportPath,
    historyDir: options.historyDir,
    headSha: options.headSha,
    baseRef: options.baseRef,
    createdAt: options.createdAt,
    focusPaths: options.focusPaths,
    changedFiles: options.changedFiles,
    reviewedFiles: options.reviewedFiles,
  });
}

function commandPrintFindings(argv) {
  const options = parseCliArgs(argv);
  const artifactPath = options.artifactPath ?? defaultArtifactPath();
  const artifact = readArtifact(artifactPath);
  process.stdout.write(`${formatLatestFindings(artifact)}\n`);
}

function main() {
  const [command, ...argv] = process.argv.slice(2);

  switch (command) {
    case "build-prompt":
      commandBuildPrompt(argv);
      break;
    case "record":
      commandRecord(argv);
      break;
    case "print-findings":
      commandPrintFindings(argv);
      break;
    default:
      throw new Error(
        "Usage: node scripts/codex-review-artifact.mjs <build-prompt|record|print-findings> [options]",
      );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
