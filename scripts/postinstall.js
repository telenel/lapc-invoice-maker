const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

try {
  if (!fs.existsSync(".git")) {
    process.exit(0);
  }

  spawnSync("git", ["config", "core.hooksPath", "hooks"], {
    stdio: "ignore",
  });
} catch {
  process.exit(0);
}
