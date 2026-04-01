import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildRemediationPlan,
  buildWorkerPrompt,
} from "./codex-review-remediation.mjs";

const POLL_INTERVAL_MS = 2000;
const LIVE_BATCH_QUIET_MS = 5000;
const AUTOPILOT_HISTORY_LIMIT = 20;
const REVIEW_HEARTBEAT_MS = 15000;
const FINAL_ARTIFACT_GRACE_MS = 15000;
const DEFAULT_CODEX_MODEL = "gpt-5.4-mini";
const DEFAULT_CODEX_REASONING_EFFORT = "xhigh";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    ...options,
  }).trim();
}

function repoContext() {
  const repoRoot = git(["rev-parse", "--show-toplevel"]);
  const gitDirRaw = git(["rev-parse", "--git-dir"], { cwd: repoRoot });
  const gitDir = path.isAbsolute(gitDirRaw)
    ? gitDirRaw
    : path.resolve(repoRoot, gitDirRaw);
  const branch = git(["branch", "--show-current"], { cwd: repoRoot });
  const headSha = git(["rev-parse", "HEAD"], { cwd: repoRoot });

  return {
    repoRoot,
    gitDir,
    branch,
    headSha,
    codexModel: process.env.LAPORTAL_CODEX_MODEL || DEFAULT_CODEX_MODEL,
    codexReasoningEffort:
      process.env.LAPORTAL_CODEX_REASONING_EFFORT || DEFAULT_CODEX_REASONING_EFFORT,
    liveStatePath: path.join(gitDir, "laportal", "codex-review.live.json"),
    finalArtifactPath: path.join(gitDir, "laportal", "codex-review.json"),
  };
}

export function parseAutopilotArgs(argv) {
  const passthrough = [];
  let help = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else {
      passthrough.push(arg);
    }
  }

  return { help, passthrough };
}

function usage() {
  return `Usage: ./scripts/codex-review-autopilot.sh [laportal:review:live options]

Starts the live Codex review producer and launches deterministic remediation workers in separate worktrees.
Pass the same base-ref or focus options you would pass to npm run laportal:review:live.`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function safeJsonRead(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function safeTextRead(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function batchSignature(batch) {
  return batch.findings
    .map((finding) => String(finding.text ?? "").trim())
    .sort()
    .join("\n---\n");
}

function latestBatchTimestamp(batch) {
  const timestamps = batch.findings
    .map((finding) => Date.parse(finding.createdAt ?? ""))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) {
    return null;
  }
  return Math.max(...timestamps);
}

export function selectDispatchableBatches({
  plan,
  launchedSignatures,
  activeFiles,
  nowMs,
  liveMode,
}) {
  const selections = [];

  for (const batch of plan) {
    const signature = batchSignature(batch);
    if (launchedSignatures.has(signature)) {
      continue;
    }

    if (batch.files.some((filePath) => activeFiles.has(filePath))) {
      continue;
    }

    if (liveMode) {
      if (batch.mode !== "worker-candidate") {
        continue;
      }

      const latestTimestamp = latestBatchTimestamp(batch);
      if (latestTimestamp === null || nowMs - latestTimestamp < LIVE_BATCH_QUIET_MS) {
        continue;
      }
    }

    selections.push(batch);
  }

  return selections;
}

export function buildAutopilotPrompt({
  artifact,
  batch,
  worktreePath,
  branchName,
  commitMessage,
  role,
}) {
  const basePrompt = buildWorkerPrompt(artifact, batch, worktreePath).trimEnd();
  const lines = [
    basePrompt,
    "",
    "Autopilot requirements:",
    `- Role: ${role}`,
    `- Worktree branch: ${branchName}`,
    `- Commit all completed changes in this worktree before exiting using exactly: ${commitMessage}`,
    "- Do not push.",
    "- Do not run any `npm run laportal:review*` command, including `laportal:review`, `laportal:review:autopilot`, `laportal:review:live`, `laportal:review:loop`, `laportal:review:triage`, `laportal:review:prompt`, or `laportal:review:watch`.",
    "- Do not run GitHub/PR commands such as `gh pr *`, `gh run *`, or `./scripts/publish-pr.sh`.",
    "- Do not run integration/history commands such as `git push`, `git cherry-pick`, `git merge`, `git rebase`, `git reset`, `git checkout`, or `git switch`.",
    "- Do not create or remove worktrees; the autopilot wrapper owns all worktree setup and cleanup.",
    "- Run focused validation relevant to the touched files if feasible.",
    "- Leave the worktree clean when you exit.",
  ];

  return `${lines.join("\n")}\n`;
}

function sanitizeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function createSession(context) {
  const startedAt = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `${startedAt}-${context.headSha.slice(0, 12)}`;
  const autopilotRoot = path.join(context.gitDir, "laportal", "autopilot");
  const sessionDir = path.join(autopilotRoot, sessionId);
  mkdirSync(sessionDir, { recursive: true });
  const worktreeRoot = mkdtempSync(
    path.join(os.tmpdir(), `laportal-codex-autopilot-${context.headSha.slice(0, 7)}-`),
  );

  return {
    autopilotRoot,
    sessionId,
    sessionDir,
    worktreeRoot,
    startedAt,
    eventsPath: path.join(sessionDir, "events.jsonl"),
    producerLogPath: path.join(sessionDir, "producer.log"),
    summaryPath: path.join(sessionDir, "summary.json"),
    summaryTextPath: path.join(sessionDir, "summary.txt"),
    latestEventsPath: path.join(autopilotRoot, "latest-events.jsonl"),
    latestSessionPath: path.join(autopilotRoot, "latest-session.json"),
    latestSummaryPath: path.join(autopilotRoot, "latest-summary.json"),
    latestSummaryTextPath: path.join(autopilotRoot, "latest-summary.txt"),
  };
}

function formatTaskSummaryLine(task) {
  const details = [
    `${task.batchId} [${task.role}] ${task.status}`,
    task.branchName ? `branch=${task.branchName}` : null,
    task.exitCode != null ? `exit=${task.exitCode}` : null,
    Array.isArray(task.integratedCommits) && task.integratedCommits.length > 0
      ? `integrated=${task.integratedCommits.length}`
      : null,
  ].filter(Boolean);
  return `- ${details.join(" | ")}`;
}

function successfulTaskCount(summary) {
  return summary.tasks?.filter((task) => task.status === "completed").length ?? 0;
}

export function buildSummaryText(summary) {
  const successCount = successfulTaskCount(summary);
  const failedCount = summary.tasks?.filter((task) => task.status === "failed").length ?? 0;
  const outcome = shouldFailSession(summary)
    ? "AUTOPILOT FAILED"
    : `AUTOPILOT COMPLETE: ${successCount} successful fix${successCount === 1 ? "" : "es"}, ${failedCount} failed task${failedCount === 1 ? "" : "s"}, nothing was pushed.`;
  const lines = [
    "LAPortal review autopilot summary",
    `outcome: ${outcome}`,
    `session: ${summary.sessionId}`,
    `started: ${summary.startedAt ?? "unknown"}`,
    `repo: ${summary.repoRoot}`,
    `branch: ${summary.branch}`,
    `head: ${summary.headSha}`,
    `model: ${summary.codexModel ?? "unknown"}`,
    `reasoning effort: ${summary.codexReasoningEffort ?? "unknown"}`,
    `review result: ${summary.reviewResult ?? "pending"}`,
    `unresolved findings: ${summary.unresolvedFindingCount ?? 0}`,
    `dispatch source: ${summary.dispatchSource ?? "pending"}`,
    `producer exit: ${summary.producerExitCode ?? "running"}`,
    `session temp root: ${summary.worktreeRoot ?? "missing"}`,
    `live snapshot: ${summary.liveStatePath ?? "missing"}`,
    `final artifact: ${summary.finalArtifactPath ?? "pending"}`,
    `events: ${summary.eventsPath ?? "missing"}`,
    `latest events: ${summary.latestEventsPath ?? "missing"}`,
    `producer log: ${summary.producerLogPath ?? "missing"}`,
    `latest summary: ${summary.latestSummaryPath ?? "missing"}`,
    `latest text summary: ${summary.latestSummaryTextPath ?? "missing"}`,
    "",
    "Tasks:",
  ];

  if (!summary.tasks || summary.tasks.length === 0) {
    lines.push("- none");
  } else {
    for (const task of summary.tasks) {
      lines.push(formatTaskSummaryLine(task));
      if (task.logPath) {
        lines.push(`  log: ${task.logPath}`);
      }
      if (task.resultPath) {
        lines.push(`  result: ${task.resultPath}`);
      }
      if (task.resultSummary) {
        lines.push(`  summary: ${task.resultSummary}`);
      }
      if (task.integratedFiles?.length) {
        lines.push(`  files: ${task.integratedFiles.join(", ")}`);
      }
      if (task.error) {
        lines.push(`  error: ${task.error}`);
      }
      if (task.cleanup?.errors?.length) {
        lines.push(`  cleanup errors: ${task.cleanup.errors.join(" ; ")}`);
      }
    }
  }

  if (summary.sessionCleanup) {
    lines.push("");
    lines.push(
      `Session cleanup: removed=${summary.sessionCleanup.worktreeRootRemoved ? "yes" : "no"} | path=${summary.sessionCleanup.worktreeRoot}`,
    );
    if (summary.sessionCleanup.reason) {
      lines.push(`  reason: ${summary.sessionCleanup.reason}`);
    }
    if (summary.sessionCleanup.error) {
      lines.push(`  error: ${summary.sessionCleanup.error}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function shouldFailSession(summary) {
  if ((summary.producerExitCode ?? 0) !== 0) {
    return true;
  }

  if (summary.tasks?.some((task) => task.status === "failed")) {
    return true;
  }

  if (summary.dispatchError) {
    return true;
  }

  if (
    summary.reviewResult === "FAIL" &&
    (summary.unresolvedFindingCount ?? 0) > 0 &&
    (summary.tasks?.length ?? 0) === 0
  ) {
    return true;
  }

  return false;
}

function buildLatestSessionState(session, summary) {
  return {
    sessionId: session.sessionId,
    sessionDir: session.sessionDir,
    startedAt: session.startedAt,
    updatedAt: new Date().toISOString(),
    branch: summary.branch,
    headSha: summary.headSha,
    status: summary.finalArtifactDispatched
      ? summary.tasks.some((task) => task.status === "running" || task.status === "integrating")
        ? "running"
        : "completed"
      : "starting",
    summaryPath: session.summaryPath,
    summaryTextPath: session.summaryTextPath,
    eventsPath: session.eventsPath,
    producerLogPath: session.producerLogPath,
    latestSummaryPath: session.latestSummaryPath,
    latestSummaryTextPath: session.latestSummaryTextPath,
    latestEventsPath: session.latestEventsPath,
  };
}

function writeSummary(session, payload) {
  const summaryText = buildSummaryText(payload);
  writeFileSync(session.summaryPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(session.summaryTextPath, summaryText);
  writeFileSync(session.latestSummaryPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(session.latestSummaryTextPath, summaryText);
  writeFileSync(
    session.latestSessionPath,
    `${JSON.stringify(buildLatestSessionState(session, payload), null, 2)}\n`,
  );
}

export function formatEventLine(event) {
  switch (event.type) {
    case "session-start":
      return `AUTOPILOT session started: ${event.sessionId} | branch=${event.branch} | head=${event.headSha} | model=${event.model} | effort=${event.reasoningEffort}`;
    case "producer-start":
      return `AUTOPILOT review started: head=${event.headSha} | model=${event.model} | effort=${event.reasoningEffort} | producer_log=${event.producerLogPath}`;
    case "review-progress":
      return `AUTOPILOT review running: elapsed=${event.elapsed} live_findings=${event.liveFindingCount} active_tasks=${event.activeTaskCount}`;
    case "review-dispatch-pending":
      return `AUTOPILOT waiting for final artifact: elapsed=${event.elapsed}`;
    case "review-result":
      if (event.result === "PASS") {
        return "AUTOPILOT REVIEW PASSED. NO ISSUES FOUND.";
      }
      return `AUTOPILOT REVIEW FOUND ${event.findingCount} ISSUE${event.findingCount === 1 ? "" : "S"}. ${event.summary}`;
    case "review-dispatch-fallback":
      return `AUTOPILOT using live snapshot fallback: findings=${event.findingCount} | wait=${event.elapsed}`;
    case "batch-launch":
      return `AUTOPILOT task started: ${event.role} ${event.batchId} | findings=${event.findingCount} | worktree=${event.worktreePath}`;
    case "task-exited":
      return `AUTOPILOT task finished in worktree: ${event.batchId} | exit=${event.exitCode}`;
    case "task-failed":
      if (event.stage === "integration") {
        return `AUTOPILOT FAILURE: ${event.batchId} produced a fix, but it was not integrated. ${event.error}`;
      }
      return `AUTOPILOT FAILURE: ${event.batchId} did not finish successfully. ${event.error}`;
    case "task-integrating":
      return `AUTOPILOT integrating ${event.batchId} into ${event.targetBranch}`;
    case "task-integrated":
      return `AUTOPILOT SUCCESS: ${event.batchId} fixed ${event.findingCount} finding${event.findingCount === 1 ? "" : "s"} and was integrated into ${event.targetBranch} (${event.commits?.length ?? 0} commit${event.commits?.length === 1 ? "" : "s"}).`;
    case "task-cleanup":
      return `AUTOPILOT cleaned ${event.batchId}: worktree=${event.worktreeRemoved ? "yes" : "no"} branch=${event.branchDeleted ? "yes" : "no"}`;
    case "task-summary":
      return `AUTOPILOT SUMMARY: ${event.batchId} | ${event.summary} | files=${event.files?.join(", ") ?? "none"}`;
    case "task-complete":
      if (event.status === "completed") {
        return `AUTOPILOT SUCCESS: ${event.batchId} is complete. ${event.integratedCount} integrated commit${event.integratedCount === 1 ? "" : "s"}.`;
      }
      return `AUTOPILOT FAILURE: ${event.batchId} is complete, but it did not integrate successfully.`;
    case "session-failed":
      return `AUTOPILOT FAILED: ${event.reason}`;
    case "session-cleanup":
      return `AUTOPILOT cleaned session temp root: removed=${event.worktreeRootRemoved ? "yes" : "no"} path=${event.worktreeRoot}`;
    case "producer-complete":
      return `AUTOPILOT review completed with exit ${event.exitCode}`;
    case "session-complete":
      return `AUTOPILOT COMPLETE: ${event.successfulTaskCount} successful fix${event.successfulTaskCount === 1 ? "" : "es"}, ${event.failedTaskCount} failed task${event.failedTaskCount === 1 ? "" : "s"}, nothing was pushed.`;
    default:
      return `AUTOPILOT ${event.type}`;
  }
}

function emitEvent(session, summary, type, fields = {}) {
  const event = {
    type,
    createdAt: new Date().toISOString(),
    sessionId: summary.sessionId,
    ...fields,
  };
  appendFileSync(session.eventsPath, `${JSON.stringify(event)}\n`);
  appendFileSync(session.latestEventsPath, `${JSON.stringify(event)}\n`);
  process.stdout.write(`${formatEventLine(event)}\n`);
  return event;
}

function resetLatestArtifacts(session) {
  writeFileSync(session.latestEventsPath, "");
}

function pruneAutopilotSessions(autopilotRoot, keepSessionId) {
  if (!existsSync(autopilotRoot)) {
    return;
  }

  const directories = readdirSync(autopilotRoot)
    .map((entry) => path.join(autopilotRoot, entry))
    .filter((entry) => {
      try {
        return statSync(entry).isDirectory();
      } catch {
        return false;
      }
    })
    .sort()
    .reverse();

  const kept = [];
  for (const directory of directories) {
    const name = path.basename(directory);
    if (name === keepSessionId || kept.length < AUTOPILOT_HISTORY_LIMIT) {
      kept.push(name);
      continue;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

function createWorktree(context, session, batch, role) {
  const batchName = sanitizeName(`${role}-${batch.id}`);
  const branchSuffix = sanitizeName(session.sessionId).slice(-16);
  const branchName = `autopilot/${context.headSha.slice(0, 12)}/${branchSuffix}-${batchName}`;
  const worktreePath = path.join(session.worktreeRoot, batchName);
  git(["worktree", "add", "-b", branchName, worktreePath, "HEAD"], {
    cwd: context.repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return { branchName, worktreePath };
}

function createTaskExitTracker(task) {
  task.child.once("error", (error) => {
    if (!task.exitState) {
      task.exitState = {
        code: 1,
        signal: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  task.child.once("close", (code, signal) => {
    if (!task.exitState) {
      task.exitState = {
        code: typeof code === "number" ? code : 1,
        signal: signal ?? null,
        error: null,
      };
    }
  });
}

function extractTaskResultSummary(resultText) {
  if (!resultText) {
    return null;
  }

  const lines = resultText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const preferredLine = lines.find((line) =>
    /^(Fixed|Resolved|Implemented|Prevented|Added|Updated|Aligned|Handled|Corrected|Made)\b/i.test(line),
  );
  if (preferredLine) {
    return preferredLine;
  }

  const whatChangedIndex = lines.findIndex((line) => line === "What changed:");
  if (whatChangedIndex >= 0) {
    const bulletLines = [];
    for (const line of lines.slice(whatChangedIndex + 1)) {
      if (line.endsWith(":") && !line.startsWith("- ")) {
        break;
      }
      if (line.startsWith("- ")) {
        bulletLines.push(line.slice(2).trim());
      }
    }
    if (bulletLines.length > 0) {
      return bulletLines.slice(0, 2).join(" | ");
    }
  }

  const usefulLine = lines.find(
    (line) =>
      !line.startsWith("Using `") &&
      !line.startsWith("Committed `") &&
      !line.startsWith("Committed as `") &&
      !line.startsWith("Status brief:") &&
      !line.startsWith("Changed files:") &&
      !line.startsWith("Validation:") &&
      !line.startsWith("Remaining risk:"),
  );
  return usefulLine ?? null;
}

function launchBatchTask(context, session, artifact, artifactPath, batch, role) {
  const { branchName, worktreePath } = createWorktree(context, session, batch, role);
  const commitMessage = `autopilot(${batch.id}): remediate codex findings`;
  const prompt = buildAutopilotPrompt({
    artifact,
    batch,
    worktreePath,
    branchName,
    commitMessage,
    role,
  });
  const logPath = path.join(session.sessionDir, `${sanitizeName(batch.id)}.log`);
  const resultPath = path.join(session.sessionDir, `${sanitizeName(batch.id)}.result.txt`);
  const logStreamWrite = (chunk) => appendFileSync(logPath, chunk.toString());

  const child = spawn(
    "codex",
    [
      "exec",
      "--full-auto",
      "--cd",
      worktreePath,
      "--model",
      context.codexModel,
      "-c",
      `model_reasoning_effort="${context.codexReasoningEffort}"`,
      "--output-last-message",
      resultPath,
      "-",
    ],
    {
      cwd: context.repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  child.stdin.end(prompt);
  child.stdout.on("data", logStreamWrite);
  child.stderr.on("data", logStreamWrite);

  const task = {
    batchId: batch.id,
    role,
    batch,
    artifactPath,
    signature: batchSignature(batch),
    branchName,
    worktreePath,
    baseHeadSha: context.headSha,
    commitMessage,
    logPath,
    resultPath,
    child,
    status: "running",
    exitState: null,
    cleanup: {
      worktreeRemoved: false,
      branchDeleted: false,
    },
  };
  createTaskExitTracker(task);
  return task;
}

function worktreeStatus(worktreePath) {
  return git(["-C", worktreePath, "status", "--short"], { cwd: worktreePath });
}

function ensureCleanRepoWorktree(repoRoot) {
  const unstaged = spawnSync("git", ["diff", "--quiet"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  const staged = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  if ((unstaged.status ?? 1) !== 0 || (staged.status ?? 1) !== 0) {
    const status = git(["status", "--short", "--branch"], { cwd: repoRoot });
    throw new Error(
      `Autopilot requires a clean working tree before it can integrate worker commits.\nCommit or stash changes first.\n\n${status}`,
    );
  }
}

function worktreeCommits(worktreePath, baseHeadSha) {
  const output = git(["-C", worktreePath, "rev-list", "--reverse", `${baseHeadSha}..HEAD`], {
    cwd: worktreePath,
  });
  if (!output) {
    return [];
  }
  return output.split("\n").filter(Boolean);
}

function commitChangedFiles(repoRoot, commits) {
  const files = new Set();
  for (const commit of commits) {
    const output = git(["show", "--name-only", "--format=", commit], {
      cwd: repoRoot,
    });
    for (const filePath of output.split("\n").filter(Boolean)) {
      files.add(filePath);
    }
  }
  return Array.from(files).sort();
}

function integrateTask(context, task) {
  const commits = worktreeCommits(task.worktreePath, task.baseHeadSha);
  if (commits.length === 0) {
    const dirty = worktreeStatus(task.worktreePath);
    if (dirty) {
      throw new Error(
        `Task ${task.batchId} exited without a commit and left uncommitted changes in ${task.worktreePath}`,
      );
    }
    return [];
  }

  const applied = [];
  for (const commit of commits) {
    try {
      git(["cherry-pick", commit], {
        cwd: context.repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
      applied.push(commit);
    } catch (error) {
      try {
        git(["cherry-pick", "--abort"], {
          cwd: context.repoRoot,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch {
        // Leave the repo state report to the caller if abort also fails.
      }
      throw new Error(
        `Failed to cherry-pick ${commit} from ${task.worktreePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return applied;
}

function cleanupTaskWorktree(context, task) {
  const cleanup = {
    worktreeRemoved: task.cleanup.worktreeRemoved,
    branchDeleted: task.cleanup.branchDeleted,
    errors: [],
  };

  if (existsSync(task.worktreePath) && !cleanup.worktreeRemoved) {
    try {
      git(["worktree", "remove", "--force", task.worktreePath], {
        cwd: context.repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
      cleanup.worktreeRemoved = true;
      task.cleanup.worktreeRemoved = true;
    } catch (error) {
      cleanup.errors.push(
        `Failed to remove worktree ${task.worktreePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (!cleanup.branchDeleted) {
    try {
      git(["branch", "-D", task.branchName], {
        cwd: context.repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
      cleanup.branchDeleted = true;
      task.cleanup.branchDeleted = true;
    } catch (error) {
      cleanup.errors.push(
        `Failed to delete branch ${task.branchName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return cleanup;
}

function cleanupSessionWorktreeRoot(session) {
  const cleanup = {
    worktreeRoot: session.worktreeRoot,
    worktreeRootRemoved: false,
    reason: null,
    error: null,
  };

  if (!existsSync(session.worktreeRoot)) {
    cleanup.reason = "missing";
    return cleanup;
  }

  let remainingEntries;
  try {
    remainingEntries = readdirSync(session.worktreeRoot);
  } catch (error) {
    cleanup.error = error instanceof Error ? error.message : String(error);
    return cleanup;
  }

  if (remainingEntries.length > 0) {
    cleanup.reason = `not-empty:${remainingEntries.length}`;
    return cleanup;
  }

  try {
    rmdirSync(session.worktreeRoot);
    cleanup.worktreeRootRemoved = true;
  } catch (error) {
    cleanup.error = error instanceof Error ? error.message : String(error);
  }

  return cleanup;
}

function snapshotState(snapshot) {
  if (!snapshot) {
    return "missing";
  }
  if (snapshot.state) {
    return snapshot.state;
  }
  return snapshot.result === null ? "running" : "completed";
}

function updateSummaryTask(summary, task, fields) {
  const summaryTask = summary.tasks.find((entry) => entry.batchId === task.batchId);
  if (summaryTask) {
    Object.assign(summaryTask, fields);
  }
}

function collectActiveFiles(tasks) {
  return new Set(
    tasks
      .filter((task) => task.status === "running" || task.status === "integrating")
      .flatMap((task) => task.batch.files),
  );
}

async function main() {
  const args = parseAutopilotArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const context = repoContext();
  ensureCleanRepoWorktree(context.repoRoot);
  const session = createSession(context);
  const sessionStartedMs = Date.now();
  const producerLogWrite = (chunk) => {
    appendFileSync(session.producerLogPath, chunk.toString());
  };

  const producer = spawn(
    "node",
    [path.join(context.repoRoot, "scripts", "codex-review-live.mjs"), ...args.passthrough],
    {
      cwd: context.repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  producer.stdout.on("data", producerLogWrite);
  producer.stderr.on("data", producerLogWrite);

  const launchedSignatures = new Set();
  const tasks = [];
  const summary = {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    headSha: context.headSha,
    codexModel: context.codexModel,
    codexReasoningEffort: context.codexReasoningEffort,
    branch: context.branch,
    repoRoot: context.repoRoot,
    worktreeRoot: session.worktreeRoot,
    autopilotRoot: session.autopilotRoot,
    eventsPath: session.eventsPath,
    latestSessionPath: session.latestSessionPath,
    latestEventsPath: session.latestEventsPath,
    producerLogPath: session.producerLogPath,
    summaryPath: session.summaryPath,
    summaryTextPath: session.summaryTextPath,
    latestSummaryPath: session.latestSummaryPath,
    latestSummaryTextPath: session.latestSummaryTextPath,
    liveStatePath: context.liveStatePath,
    finalArtifactPath: null,
    producerExitCode: null,
    finalArtifactDispatched: false,
    reviewResult: null,
    unresolvedFindingCount: 0,
    dispatchSource: null,
    dispatchError: null,
    tasks: [],
  };
  resetLatestArtifacts(session);
  writeSummary(session, summary);
  emitEvent(session, summary, "session-start", {
    repoRoot: context.repoRoot,
    branch: context.branch,
    headSha: context.headSha,
    model: context.codexModel,
    reasoningEffort: context.codexReasoningEffort,
    worktreeRoot: session.worktreeRoot,
  });
  emitEvent(session, summary, "producer-start", {
    headSha: context.headSha,
    model: context.codexModel,
    reasoningEffort: context.codexReasoningEffort,
    liveStatePath: context.liveStatePath,
    producerLogPath: session.producerLogPath,
  });

  let producerExited = false;
  let producerExitCode = null;
  let producerExitedAtMs = null;
  let lastReviewHeartbeatAt = Date.now();
  let lastDispatchPendingAt = 0;
  producer.on("close", (code) => {
    producerExited = true;
    producerExitCode = typeof code === "number" ? code : 1;
    producerExitedAtMs = Date.now();
  });
  producer.on("error", (error) => {
    producerExited = true;
    producerExitCode = 1;
    summary.producerError = error instanceof Error ? error.message : String(error);
    writeSummary(session, summary);
  });

  const registerBatches = (artifactPath, artifact, liveMode) => {
    if (!artifact?.findings?.length) {
      return;
    }

    const plan = buildRemediationPlan(artifact, context.repoRoot);
    const activeFiles = collectActiveFiles(tasks);
    const launchable = selectDispatchableBatches({
      plan,
      launchedSignatures,
      activeFiles,
      nowMs: Date.now(),
      liveMode,
    });

    for (const batch of launchable) {
      const signature = batchSignature(batch);
      launchedSignatures.add(signature);
      const role = batch.mode === "main-agent" ? "coordinator" : "worker";
      const task = launchBatchTask(context, session, artifact, artifactPath, batch, role);
      tasks.push(task);
      summary.tasks.push({
        batchId: batch.id,
        role,
        branchName: task.branchName,
        worktreePath: task.worktreePath,
        logPath: task.logPath,
        resultPath: task.resultPath,
        artifactPath,
        status: "running",
        files: batch.files,
        findingIds: batch.findingIds,
      });
      writeSummary(session, summary);
      emitEvent(session, summary, "batch-launch", {
        batchId: batch.id,
        role,
        artifactPath,
        worktreePath: task.worktreePath,
        branchName: task.branchName,
        files: batch.files,
        findingCount: Array.isArray(batch.findings) ? batch.findings.length : 0,
      });
    }
  };

  const dispatchArtifact = (artifactPath, artifact, source) => {
    registerBatches(artifactPath, artifact, false);
    summary.finalArtifactPath =
      source === "final-artifact" ? artifactPath : summary.finalArtifactPath;
    summary.reviewResult = artifact.result ?? "UNKNOWN";
    summary.unresolvedFindingCount = Array.isArray(artifact.findings) ? artifact.findings.length : 0;
    summary.dispatchSource = source;
    summary.finalArtifactDispatched = true;
    emitEvent(session, summary, "review-result", {
      result: summary.reviewResult,
      findingCount: summary.unresolvedFindingCount,
      summary: artifact.summary ?? "No summary provided",
      artifactPath,
    });
    if (source === "live-fallback") {
      emitEvent(session, summary, "review-dispatch-fallback", {
        findingCount: summary.unresolvedFindingCount,
        elapsed: formatDuration(Date.now() - producerExitedAtMs),
        artifactPath,
      });
    }
    writeSummary(session, summary);
  };

  try {
    while (true) {
      const liveSnapshot = safeJsonRead(context.liveStatePath);
      const liveState = snapshotState(liveSnapshot);
      const activeTaskCount = tasks.filter(
        (task) => task.status === "running" || task.status === "integrating",
      ).length;
      if (!producerExited && Date.now() - lastReviewHeartbeatAt >= REVIEW_HEARTBEAT_MS) {
        emitEvent(session, summary, "review-progress", {
          elapsed: formatDuration(Date.now() - sessionStartedMs),
          liveFindingCount: Array.isArray(liveSnapshot?.findings) ? liveSnapshot.findings.length : 0,
          activeTaskCount,
        });
        lastReviewHeartbeatAt = Date.now();
      }
      if (liveState === "running" || liveState === "completing") {
        registerBatches(context.liveStatePath, liveSnapshot, true);
      }

      if (!summary.finalArtifactDispatched && producerExited) {
        const finalArtifact =
          existsSync(context.finalArtifactPath) ? safeJsonRead(context.finalArtifactPath) : null;
        if (finalArtifact) {
          dispatchArtifact(context.finalArtifactPath, finalArtifact, "final-artifact");
        } else {
          const waitMs = producerExitedAtMs == null ? 0 : Date.now() - producerExitedAtMs;
          if (Date.now() - lastDispatchPendingAt >= REVIEW_HEARTBEAT_MS) {
            emitEvent(session, summary, "review-dispatch-pending", {
              elapsed: formatDuration(waitMs),
            });
            lastDispatchPendingAt = Date.now();
          }

          if (waitMs >= FINAL_ARTIFACT_GRACE_MS) {
            if (Array.isArray(liveSnapshot?.findings) && liveSnapshot.findings.length > 0) {
              dispatchArtifact(
                context.liveStatePath,
                {
                  ...liveSnapshot,
                  result: liveSnapshot.result ?? "FAIL",
                  summary: `Final artifact unavailable after ${formatDuration(waitMs)}; using live finding snapshot.`,
                },
                "live-fallback",
              );
            } else {
              summary.reviewResult = liveSnapshot?.result ?? "UNKNOWN";
              summary.unresolvedFindingCount = Array.isArray(liveSnapshot?.findings)
                ? liveSnapshot.findings.length
                : 0;
              summary.dispatchSource = "none";
              summary.dispatchError = `Final artifact was not readable after ${formatDuration(waitMs)}`;
              summary.finalArtifactDispatched = true;
              writeSummary(session, summary);
            }
          }
        }
      }

      for (const task of tasks.filter((entry) => entry.status === "running")) {
        if (!task.exitState) {
          continue;
        }

        const { code, signal, error } = task.exitState;
        emitEvent(session, summary, "task-exited", {
          batchId: task.batchId,
          role: task.role,
          exitCode: code,
          signal,
        });
        if (code !== 0) {
          task.status = "failed";
          updateSummaryTask(summary, task, {
            status: "failed",
            exitCode: code,
            signal,
            error: error ?? `Worker exited with code ${code}`,
          });
          const cleanup = cleanupTaskWorktree(context, task);
          updateSummaryTask(summary, task, { cleanup });
          writeSummary(session, summary);
          emitEvent(session, summary, "task-failed", {
            batchId: task.batchId,
            role: task.role,
            exitCode: code,
            signal,
            stage: "execution",
            error: error ?? `Worker exited with code ${code}`,
          });
          emitEvent(session, summary, "task-cleanup", {
            batchId: task.batchId,
            worktreeRemoved: cleanup.worktreeRemoved,
            branchDeleted: cleanup.branchDeleted,
            errors: cleanup.errors,
          });
          emitEvent(session, summary, "task-complete", {
            batchId: task.batchId,
            status: "failed",
            integratedCount: 0,
          });
          continue;
        }

        task.status = "integrating";
        updateSummaryTask(summary, task, {
          status: "integrating",
          exitCode: code,
          signal,
        });
        writeSummary(session, summary);
        emitEvent(session, summary, "task-integrating", {
          batchId: task.batchId,
          role: task.role,
          worktreePath: task.worktreePath,
          targetBranch: context.branch,
        });

        let integratedCount = 0;
        let integratedFiles = [];
        try {
          const commits = integrateTask(context, task);
          integratedCount = commits.length;
          integratedFiles = commitChangedFiles(context.repoRoot, commits);
          const resultSummary = extractTaskResultSummary(safeTextRead(task.resultPath));
          task.status = "completed";
          updateSummaryTask(summary, task, {
            status: "completed",
            integratedCommits: commits,
            resultSummary,
            integratedFiles,
          });
          emitEvent(session, summary, "task-integrated", {
            batchId: task.batchId,
            role: task.role,
            findingCount: task.batch.findingIds?.length ?? task.batch.findings?.length ?? 0,
            commits,
            targetBranch: context.branch,
          });
          if (resultSummary) {
            emitEvent(session, summary, "task-summary", {
              batchId: task.batchId,
              summary: resultSummary,
              files: integratedFiles,
            });
          }
        } catch (integrationError) {
          task.status = "failed";
          updateSummaryTask(summary, task, {
            status: "failed",
            error:
              integrationError instanceof Error
                ? integrationError.message
                : String(integrationError),
          });
          emitEvent(session, summary, "task-failed", {
            batchId: task.batchId,
            role: task.role,
            exitCode: code,
            signal,
            stage: "integration",
            error:
              integrationError instanceof Error
                ? integrationError.message
                : String(integrationError),
          });
        }

        const cleanup = cleanupTaskWorktree(context, task);
        updateSummaryTask(summary, task, { cleanup });
        writeSummary(session, summary);
        emitEvent(session, summary, "task-cleanup", {
          batchId: task.batchId,
          worktreeRemoved: cleanup.worktreeRemoved,
          branchDeleted: cleanup.branchDeleted,
          errors: cleanup.errors,
        });
        emitEvent(session, summary, "task-complete", {
          batchId: task.batchId,
          status: task.status,
          integratedCount,
        });
      }

      const runningTasks = tasks.some((task) => task.status === "running");
      if (producerExited && summary.finalArtifactDispatched && !runningTasks) {
        break;
      }

      await sleep(POLL_INTERVAL_MS);
    }
  } finally {
    summary.producerExitCode = producerExitCode;
    summary.finalArtifactPath = existsSync(context.finalArtifactPath)
      ? context.finalArtifactPath
      : summary.finalArtifactPath;
    summary.liveStatePath = existsSync(context.liveStatePath) ? context.liveStatePath : null;
    writeSummary(session, summary);
    emitEvent(session, summary, "producer-complete", {
      exitCode: producerExitCode,
      finalArtifactPath: summary.finalArtifactPath,
    });
  }

  emitEvent(session, summary, "session-complete", {
    taskCount: summary.tasks.length,
    successfulTaskCount: successfulTaskCount(summary),
    failedTaskCount: summary.tasks.filter((task) => task.status === "failed").length,
  });
  if (summary.dispatchError) {
    emitEvent(session, summary, "session-failed", {
      reason: summary.dispatchError,
    });
  } else if (shouldFailSession(summary)) {
    emitEvent(session, summary, "session-failed", {
      reason: `Review reported ${summary.unresolvedFindingCount} unresolved finding(s) but no remediation task completed.`,
    });
  }
  summary.sessionCleanup = cleanupSessionWorktreeRoot(session);
  emitEvent(session, summary, "session-cleanup", summary.sessionCleanup);
  pruneAutopilotSessions(session.autopilotRoot, session.sessionId);
  writeSummary(session, summary);
  process.stdout.write("\n==> Autopilot summary\n");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`Summary text: ${session.summaryTextPath}\n`);
  process.stdout.write(`Events log: ${session.eventsPath}\n`);
  process.stdout.write(`Latest summary: ${session.latestSummaryPath}\n`);
  process.stdout.write(`Latest text summary: ${session.latestSummaryTextPath}\n`);
  process.stdout.write(`Latest events: ${session.latestEventsPath}\n`);

  process.exitCode = shouldFailSession(summary) ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
