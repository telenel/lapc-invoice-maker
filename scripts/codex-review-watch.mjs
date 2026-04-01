import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function gitDir() {
  return execFileSync("git", ["rev-parse", "--git-dir"], {
    encoding: "utf8",
  }).trim();
}

function parseArgs(argv) {
  return {
    follow: argv.includes("--follow"),
  };
}

function latestSessionDir(rootDir) {
  if (!existsSync(rootDir)) {
    return null;
  }

  const sessions = readdirSync(rootDir)
    .map((entry) => path.join(rootDir, entry))
    .filter((entry) => {
      try {
        return statSync(entry).isDirectory();
      } catch {
        return false;
      }
    })
    .sort()
    .reverse();

  return sessions[0] ?? null;
}

function printCurrentState(sessionDir) {
  const summaryTextPath = path.join(sessionDir, "summary.txt");
  const eventsPath = path.join(sessionDir, "events.jsonl");

  if (existsSync(summaryTextPath)) {
    process.stdout.write(`${readFileSync(summaryTextPath, "utf8")}\n`);
  } else {
    process.stdout.write(`Summary not found yet: ${summaryTextPath}\n`);
  }

  if (existsSync(eventsPath)) {
    process.stdout.write(`Events log: ${eventsPath}\n`);
  }
}

async function followEvents(sessionDir) {
  const eventsPath = path.join(sessionDir, "events.jsonl");
  let offset = 0;

  process.stdout.write(`Watching ${eventsPath}\n`);
  while (true) {
    if (existsSync(eventsPath)) {
      const text = readFileSync(eventsPath, "utf8");
      if (text.length > offset) {
        process.stdout.write(text.slice(offset));
        offset = text.length;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(gitDir(), "laportal", "autopilot");
  const sessionDir = latestSessionDir(rootDir);

  if (!sessionDir) {
    throw new Error(`No autopilot session found under ${rootDir}`);
  }

  process.stdout.write(`Latest autopilot session: ${sessionDir}\n\n`);
  printCurrentState(sessionDir);

  if (args.follow) {
    process.stdout.write("\n");
    await followEvents(sessionDir);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
