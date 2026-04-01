import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseCliArgs(argv) {
  const options = {
    json: false,
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

    if (arg.startsWith("--artifact=")) {
      options.artifactPath = arg.slice("--artifact=".length);
      continue;
    }

    if (arg.startsWith("--batch=")) {
      options.batchId = arg.slice("--batch=".length);
      continue;
    }

    switch (arg) {
      case "--artifact":
        options.artifactPath = readValue();
        break;
      case "--batch":
        options.batchId = readValue();
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function repoRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
}

function defaultArtifactPath() {
  const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], {
    encoding: "utf8",
  }).trim();

  return path.resolve(gitDir, "laportal", "codex-review.json");
}

function readArtifact(artifactPath) {
  if (!existsSync(artifactPath)) {
    throw new Error(`Codex review artifact not found at ${artifactPath}`);
  }

  return JSON.parse(readFileSync(artifactPath, "utf8"));
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeRepoPath(rawPath, rootDir) {
  if (!rawPath) {
    return null;
  }

  const withoutFragment = rawPath.split("#")[0];
  const withoutFileScheme = withoutFragment.startsWith("file://")
    ? withoutFragment.slice("file://".length)
    : withoutFragment;
  const withoutLine = withoutFileScheme.replace(/:(?:\d+)(?::\d+)?$/, "");
  const normalized = path.normalize(withoutLine);

  if (path.isAbsolute(normalized)) {
    const relative = path.relative(rootDir, normalized);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return relative;
    }
    return null;
  }

  if (normalized.startsWith("..")) {
    return null;
  }

  return normalized.replace(/^[./]+/, "");
}

function extractFileReferences(text, rootDir) {
  const matches = [];
  const seen = new Set();

  const pushMatch = (candidate) => {
    const normalized = normalizeRepoPath(candidate, rootDir);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    matches.push(normalized);
  };

  const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const match of text.matchAll(markdownLinkPattern)) {
    const [, label, href] = match;
    pushMatch(href);
    pushMatch(label);
  }

  const repoPathPattern =
    /((?:src|tests|scripts|docs|prisma|hooks|\.codex)\/[A-Za-z0-9_./[\]-]+\.(?:tsx|ts|mjs|js|sh|md|prisma|sql|json|yaml|yml))(?:[:#][A-Za-z0-9:]+)?/g;
  for (const match of text.matchAll(repoPathPattern)) {
    pushMatch(match[1]);
  }

  return matches.sort();
}

function buildFindingRecords(artifact, rootDir) {
  return (artifact.findings ?? [])
    .filter((finding) => finding.status !== "resolved")
    .map((finding) => ({
      id: finding.id,
      status: finding.status,
      text: finding.text,
      createdAt: finding.createdAt ?? artifact.createdAt ?? null,
      files: extractFileReferences(finding.text, rootDir),
    }));
}

function filesOverlap(left, right) {
  return left.some((filePath) => right.includes(filePath));
}

function summarizeFinding(text) {
  return text
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function recommendExecution(batch) {
  if (batch.files.length === 0) {
    return {
      mode: "main-agent",
      reason: "No stable repo file ownership could be extracted from the finding text.",
    };
  }

  if (
    batch.files.some((filePath) =>
      /schema\.prisma$|\/migrations\/.+\.sql$/.test(filePath),
    )
  ) {
    return {
      mode: "main-agent",
      reason: "Schema and migration work is too coupled for blind worker delegation.",
    };
  }

  if (
    batch.files.length > 3 ||
    batch.findings.length > 1 ||
    batch.files.some((filePath) => /\/service\.ts$/.test(filePath))
  ) {
    return {
      mode: "main-agent",
      reason: "This batch touches a coupled workflow surface and should stay with the coordinating agent.",
    };
  }

  return {
    mode: "worker-candidate",
    reason: "This batch has a bounded file set and is a reasonable worker handoff candidate.",
  };
}

export function buildRemediationPlan(artifact, rootDir) {
  const findings = buildFindingRecords(artifact, rootDir);
  const batches = [];

  for (const finding of findings) {
    const overlapping = batches.filter((batch) =>
      finding.files.length > 0 && filesOverlap(batch.files, finding.files),
    );

    if (overlapping.length === 0) {
      batches.push({
        findings: [finding],
        files: [...finding.files],
      });
      continue;
    }

    const primary = overlapping[0];
    primary.findings.push(finding);
    primary.files = unique([...primary.files, ...finding.files]).sort();

    for (const duplicate of overlapping.slice(1)) {
      primary.findings.push(...duplicate.findings);
      primary.files = unique([...primary.files, ...duplicate.files]).sort();
      batches.splice(batches.indexOf(duplicate), 1);
    }
  }

  return batches.map((batch, index) => {
    const recommendation = recommendExecution(batch);
    return {
      id: `B${index + 1}`,
      mode: recommendation.mode,
      reason: recommendation.reason,
      findingIds: batch.findings.map((finding) => finding.id),
      files: batch.files,
      findings: batch.findings.map((finding) => ({
        id: finding.id,
        text: finding.text,
        summary: summarizeFinding(finding.text),
        createdAt: finding.createdAt,
        files: finding.files,
      })),
    };
  });
}

export function buildWorkerPromptCommand(artifactPath) {
  const normalized = artifactPath.replace(/\\/g, "/");
  if (normalized.endsWith("codex-review.live.json")) {
    return `npm run laportal:review:prompt -- --artifact ${artifactPath} --batch <BATCH_ID>`;
  }

  return "npm run laportal:review:prompt -- --batch <BATCH_ID>";
}

export function formatRemediationPlan(artifact, plan, artifactPath) {
  const reviewResult = artifact.result ?? "IN_PROGRESS";
  const reviewSummary = artifact.summary ?? "Live review snapshot in progress";
  const lines = [
    `Latest Codex review: ${reviewResult} for ${artifact.headSha} against ${artifact.baseRef} at ${artifact.createdAt ?? "unknown"}`,
    `Summary: ${reviewSummary}`,
    `Artifact: ${artifactPath}`,
    `Unresolved findings: ${(artifact.findings ?? []).filter((finding) => finding.status !== "resolved").length}`,
  ];

  if (plan.length === 0) {
    lines.push("No remediation batches generated.");
    return lines.join("\n");
  }

  lines.push("Remediation batches:");
  for (const batch of plan) {
    lines.push(
      `${batch.id} [${batch.mode}] ${batch.findings.length} finding${batch.findings.length === 1 ? "" : "s"}, ${batch.files.length} file${batch.files.length === 1 ? "" : "s"}`,
    );
    lines.push(`  Reason: ${batch.reason}`);
    lines.push(
      `  Files: ${batch.files.length > 0 ? batch.files.join(", ") : "none extracted"}`,
    );
    for (const finding of batch.findings) {
      lines.push(`  - ${finding.id}: ${finding.summary}`);
    }
  }

  lines.push("");
  lines.push("Worker prompt command:");
  lines.push(buildWorkerPromptCommand(artifactPath));

  return lines.join("\n");
}

export function buildWorkerPrompt(artifact, batch, rootDir) {
  const lines = [
    "You are fixing a bounded subset of the latest LAPortal Codex review findings.",
    "",
    "Repo context:",
    `- Worktree: ${rootDir}`,
    `- HEAD: ${artifact.headSha}`,
    `- Base ref: ${artifact.baseRef}`,
    `- Review result: ${artifact.result}`,
    `- Review summary: ${artifact.summary}`,
    `- Batch: ${batch.id}`,
    "",
    "Ownership:",
    `- Edit only these repo files unless absolutely necessary: ${batch.files.length > 0 ? batch.files.join(", ") : "none extracted"}`,
    "- You are not alone in the codebase. Do not revert others' changes.",
    "- Add or update targeted tests for each non-trivial fix in this batch.",
    "",
    "Findings to resolve:",
    ...batch.findings.map((finding) => `- ${finding.id}: ${finding.text}`),
    "",
    "Delivery requirements:",
    "- Resolve the findings completely within the owned file set.",
    "- If you must touch an additional file, explain why before doing so.",
    "- In your final response, list every file changed and any remaining risks.",
    "- The coordinating agent will run npm run ship-check and npm run laportal:review after integration.",
  ];

  return `${lines.join("\n")}\n`;
}

function commandTriage(argv) {
  const options = parseCliArgs(argv);
  const artifactPath = options.artifactPath ?? defaultArtifactPath();
  const artifact = readArtifact(artifactPath);
  const rootDir = repoRoot();
  const plan = buildRemediationPlan(artifact, rootDir);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          artifact: {
            path: artifactPath,
            headSha: artifact.headSha,
            baseRef: artifact.baseRef,
            result: artifact.result,
            summary: artifact.summary,
            createdAt: artifact.createdAt,
          },
          batches: plan,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  process.stdout.write(`${formatRemediationPlan(artifact, plan, artifactPath)}\n`);
}

function commandPrompt(argv) {
  const options = parseCliArgs(argv);
  if (!options.batchId) {
    throw new Error("prompt requires --batch <BATCH_ID>");
  }

  const artifactPath = options.artifactPath ?? defaultArtifactPath();
  const artifact = readArtifact(artifactPath);
  const rootDir = repoRoot();
  const plan = buildRemediationPlan(artifact, rootDir);
  const batch = plan.find((entry) => entry.id === options.batchId);

  if (!batch) {
    throw new Error(`Batch ${options.batchId} not found in ${artifactPath}`);
  }

  process.stdout.write(buildWorkerPrompt(artifact, batch, rootDir));
}

function main() {
  const [command, ...argv] = process.argv.slice(2);

  switch (command) {
    case "triage":
      commandTriage(argv);
      break;
    case "prompt":
      commandPrompt(argv);
      break;
    default:
      throw new Error(
        "Usage: node scripts/codex-review-remediation.mjs <triage|prompt> [options]",
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
