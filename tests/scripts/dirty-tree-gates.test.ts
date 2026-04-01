import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureCleanRepoWorktree } from "../../scripts/codex-review-autopilot.mjs";

const repoRoot = process.cwd();
const tempDirs: string[] = [];

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function assertSuccess(command: string, result: ReturnType<typeof spawnSync>) {
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with status ${result.status ?? "null"}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

function initRepo(repoDir: string) {
  assertSuccess("git init", run("git", ["init"], repoDir));
  assertSuccess("git config user.email", run("git", ["config", "user.email", "codex@example.com"], repoDir));
  assertSuccess("git config user.name", run("git", ["config", "user.name", "Codex"], repoDir));
}

function createRepoFixture(trackedPaths: string[]) {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), "laportal-dirty-tree-"));
  tempDirs.push(repoDir);
  initRepo(repoDir);

  for (const trackedPath of trackedPaths) {
    const sourcePath = path.join(repoRoot, trackedPath);
    const targetPath = path.join(repoDir, trackedPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }

  assertSuccess("git add", run("git", ["add", ...trackedPaths], repoDir));
  assertSuccess("git commit", run("git", ["commit", "-m", "seed fixture"], repoDir));
  if (run("git", ["rev-parse", "--verify", "main^{commit}"], repoDir).status !== 0) {
    assertSuccess("git branch main", run("git", ["branch", "main"], repoDir));
  }

  return repoDir;
}

function createFakeCli(repoDir: string, name: string) {
  const binDir = path.join(repoDir, "bin");
  mkdirSync(binDir, { recursive: true });
  const invocationLog = path.join(repoDir, `${name}.invoked`);
  const script = `#!/bin/sh
printf '%s %s\n' ${JSON.stringify(name)} "$*" >> ${JSON.stringify(invocationLog)}
exit 99
`;
  const cliPath = path.join(binDir, name);
  writeFileSync(cliPath, script, { mode: 0o755 });
  return { binDir, invocationLog };
}

function runScript(repoDir: string, scriptPath: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync("/bin/bash", [scriptPath], {
    cwd: repoDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

describe("workflow dirty-tree gates", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("blocks ship-check when an untracked file is present", () => {
    const repoDir = createRepoFixture(["scripts/ship-check.sh"]);
    writeFileSync(path.join(repoDir, "stray-new-file.txt"), "untracked\n");

    const result = runScript(repoDir, "scripts/ship-check.sh");
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).toBe(1);
    expect(output).toContain("BLOCKED: ship-check requires a clean working tree with no staged, unstaged, or untracked changes.");
    expect(output).toContain("?? stray-new-file.txt");
    expect(output).not.toContain("npm run lint");
  });

  it("blocks local Codex review when an untracked file is present", () => {
    const repoDir = createRepoFixture([
      "scripts/codex-review-local.sh",
      "scripts/codex-review-artifact.mjs",
      ".codex/prompts/local-review.md",
    ]);
    const { binDir, invocationLog } = createFakeCli(repoDir, "codex");
    writeFileSync(path.join(repoDir, "stray-new-file.txt"), "untracked\n");

    const result = runScript(repoDir, "scripts/codex-review-local.sh", {
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).toBe(1);
    expect(output).toContain(
      "BLOCKED: local Codex review requires a clean working tree with no staged, unstaged, or untracked changes.",
    );
    expect(output).toContain("?? stray-new-file.txt");
    expect(existsSync(invocationLog)).toBe(false);
  });

  it("blocks autopilot when an untracked file is present", () => {
    const repoDir = createRepoFixture(["scripts/codex-review-autopilot.mjs"]);
    writeFileSync(path.join(repoDir, "stray-new-file.txt"), "untracked\n");

    let error: unknown;
    try {
      ensureCleanRepoWorktree(repoDir);
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : String(error)).toContain(
      "Autopilot requires a clean working tree before it can integrate worker commits.",
    );
    expect(error instanceof Error ? error.message : String(error)).toContain("?? stray-new-file.txt");
  });

  it("blocks publish-pr when an untracked file is present", () => {
    const repoDir = createRepoFixture(["scripts/publish-pr.sh"]);
    const { binDir, invocationLog } = createFakeCli(repoDir, "gh");
    writeFileSync(path.join(repoDir, "stray-new-file.txt"), "untracked\n");

    const result = runScript(repoDir, "scripts/publish-pr.sh", {
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).toBe(1);
    expect(output).toContain(
      "BLOCKED: publish-pr requires a clean working tree with no staged, unstaged, or untracked changes.",
    );
    expect(output).toContain("?? stray-new-file.txt");
    expect(existsSync(invocationLog)).toBe(false);
  });
});
