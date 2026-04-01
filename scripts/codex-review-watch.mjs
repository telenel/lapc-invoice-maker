import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

function latestSession(rootDir) {
  const latestSessionPath = path.join(rootDir, "latest-session.json");
  if (!existsSync(latestSessionPath)) {
    return null;
  }

  return JSON.parse(readFileSync(latestSessionPath, "utf8"));
}

function printCurrentState(session) {
  const summaryTextPath = session.latestSummaryTextPath ?? session.summaryTextPath;
  const eventsPath = session.latestEventsPath ?? session.eventsPath;

  if (existsSync(summaryTextPath)) {
    process.stdout.write(`${readFileSync(summaryTextPath, "utf8")}\n`);
  } else {
    process.stdout.write(`Summary not found yet: ${summaryTextPath}\n`);
  }

  if (existsSync(eventsPath)) {
    process.stdout.write(`Events log: ${eventsPath}\n`);
  }
}

async function followEvents(session) {
  const eventsPath = session.latestEventsPath ?? session.eventsPath;
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
  const session = latestSession(rootDir);

  if (!session) {
    throw new Error(`No autopilot session found under ${rootDir}`);
  }

  process.stdout.write(`Latest autopilot session: ${session.sessionDir}\n\n`);
  printCurrentState(session);

  if (args.follow) {
    process.stdout.write("\n");
    await followEvents(session);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
