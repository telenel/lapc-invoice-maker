import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
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

export function batchSignature(batch) {
  return batch.findings
    .map((finding) => finding.text.trim())
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

export function buildSummaryText(summary) {
  const lines = [
    "LAPortal review autopilot summary",
    `session: ${summary.sessionId}`,
    `started: ${summary.startedAt ?? "unknown"}`,
    `repo: ${summary.repoRoot}`,
    `branch: ${summary.branch}`,
    `head: ${summary.headSha}`,
    `producer exit: ${summary.producerExitCode ?? "running"}`,
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
      if (task.error) {
        lines.push(`  error: ${task.error}`);
      }
      if (task.cleanup?.errors?.length) {
        lines.push(`  cleanup errors: ${task.cleanup.errors.join(" ; ")}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
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
      return `AUTOPILOT session started: ${event.sessionId}`;
    case "producer-start":
      return `AUTOPILOT review started for ${event.headSha}`;
    case "batch-launch":
      return `AUTOPILOT launched ${event.role} ${event.batchId} in ${event.worktreePath}`;
    case "task-failed":
      return `AUTOPILOT ${event.batchId} failed: ${event.error}`;
    case "task-integrating":
      return `AUTOPILOT integrating ${event.batchId}`;
    case "task-integrated":
      return `AUTOPILOT integrated ${event.batchId} (${event.commits?.length ?? 0} commit${event.commits?.length === 1 ? "" : "s"})`;
    case "task-cleanup":
      return `AUTOPILOT cleaned ${event.batchId}: worktree=${event.worktreeRemoved ? "yes" : "no"} branch=${event.branchDeleted ? "yes" : "no"}`;
    case "producer-complete":
      return `AUTOPILOT review completed with exit ${event.exitCode}`;
    case "session-complete":
      return `AUTOPILOT session complete: tasks=${event.taskCount} failed=${event.failedTaskCount}`;
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
  const logStreamWrite = (chunk) => appendFileSync(logPath, chunk.toString());

  const child = spawn(
    "codex",
    ["exec", "--full-auto", "--cd", worktreePath, "-"],
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

function worktreeCommits(worktreePath, baseHeadSha) {
  const output = git(["-C", worktreePath, "rev-list", "--reverse", `${baseHeadSha}..HEAD`], {
    cwd: worktreePath,
  });
  if (!output) {
    return [];
  }
  return output.split("\n").filter(Boolean);
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
  const session = createSession(context);
  const producerLogWrite = (chunk) => {
    appendFileSync(session.producerLogPath, chunk.toString());
    process.stdout.write(chunk.toString());
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
    tasks: [],
  };
  resetLatestArtifacts(session);
  writeSummary(session, summary);
  emitEvent(session, summary, "session-start", {
    repoRoot: context.repoRoot,
    branch: context.branch,
    headSha: context.headSha,
    worktreeRoot: session.worktreeRoot,
  });
  emitEvent(session, summary, "producer-start", {
    headSha: context.headSha,
    liveStatePath: context.liveStatePath,
  });

  let producerExited = false;
  let producerExitCode = null;
  producer.on("close", (code) => {
    producerExited = true;
    producerExitCode = typeof code === "number" ? code : 1;
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
      });
    }
  };

  let finalArtifactChecked = false;

  try {
    while (true) {
      const liveSnapshot = safeJsonRead(context.liveStatePath);
      const liveState = snapshotState(liveSnapshot);
      if (liveState === "running" || liveState === "completing") {
        registerBatches(context.liveStatePath, liveSnapshot, true);
      }

      if (!finalArtifactChecked && producerExited) {
        finalArtifactChecked = true;
        if (existsSync(context.finalArtifactPath)) {
          const finalArtifact = safeJsonRead(context.finalArtifactPath);
          if (finalArtifact) {
            registerBatches(context.finalArtifactPath, finalArtifact, false);
            summary.finalArtifactPath = context.finalArtifactPath;
          }
        }
        summary.finalArtifactDispatched = true;
        writeSummary(session, summary);
      }

      for (const task of tasks.filter((entry) => entry.status === "running")) {
        if (!task.exitState) {
          continue;
        }

        const { code, signal, error } = task.exitState;
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
            error: error ?? `Worker exited with code ${code}`,
          });
          emitEvent(session, summary, "task-cleanup", {
            batchId: task.batchId,
            worktreeRemoved: cleanup.worktreeRemoved,
            branchDeleted: cleanup.branchDeleted,
            errors: cleanup.errors,
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
        });

        try {
          const commits = integrateTask(context, task);
          task.status = "completed";
          updateSummaryTask(summary, task, {
            status: "completed",
            integratedCommits: commits,
          });
          emitEvent(session, summary, "task-integrated", {
            batchId: task.batchId,
            role: task.role,
            commits,
          });
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
      }

      const runningTasks = tasks.some((task) => task.status === "running");
      if (producerExited && finalArtifactChecked && !runningTasks) {
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
    failedTaskCount: summary.tasks.filter((task) => task.status === "failed").length,
  });
  pruneAutopilotSessions(session.autopilotRoot, session.sessionId);
  writeSummary(session, summary);
  process.stdout.write("\n==> Autopilot summary\n");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`Summary text: ${session.summaryTextPath}\n`);
  process.stdout.write(`Events log: ${session.eventsPath}\n`);
  process.stdout.write(`Latest summary: ${session.latestSummaryPath}\n`);
  process.stdout.write(`Latest text summary: ${session.latestSummaryTextPath}\n`);
  process.stdout.write(`Latest events: ${session.latestEventsPath}\n`);

  const hasFailedTasks = summary.tasks.some((task) => task.status === "failed");
  process.exitCode =
    producerExitCode && producerExitCode !== 0
      ? producerExitCode
      : hasFailedTasks
        ? 1
        : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
