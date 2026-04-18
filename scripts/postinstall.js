const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

try {
  if (!fs.existsSync(".git")) {
    process.exit(0);
  }

  const repoConfigs = [
    ["core.hooksPath", "hooks"],
    ["pull.ff", "only"],
    ["fetch.prune", "true"],
    ["rerere.enabled", "true"],
    ["merge.conflictStyle", "zdiff3"],
    ["push.autoSetupRemote", "true"],
  ];

  for (const [key, value] of repoConfigs) {
    spawnSync("git", ["config", "--local", key, value], {
      stdio: "ignore",
    });
  }
} catch {
  process.exit(0);
}
