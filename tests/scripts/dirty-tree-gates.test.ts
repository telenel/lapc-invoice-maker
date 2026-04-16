import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const tempDirs: string[] = [];

function run(command: string, args: string[], cwd: string, env: Record<string, string | undefined> = {}) {
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

function runScript(repoDir: string, scriptPath: string, env: Record<string, string | undefined> = {}) {
  // Resolve `bash` from PATH so the test works on Windows (where /bin/bash
  // doesn't exist) as well as on Linux/macOS CI runners.
  const shell = process.platform === "win32" ? "bash.exe" : "/bin/bash";
  return spawnSync(shell, [scriptPath], {
    cwd: repoDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

describe("ship-check dirty-tree gate", () => {
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
});
