/**
 * Phase 1 verification runner — invoke runPrismPull directly and print the
 * PullSyncResult. Used for the 2026-04-19 end-to-end smoke test documented in
 * docs/prism/phase-1-verification-2026-04-19.md.
 *
 * Run with:  npx tsx scripts/run-phase-1-sync.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { runPrismPull } from "@/domains/product/prism-sync";

async function main() {
  console.log("Starting Phase 1 sync (PIER + PCOP + PFS)...");
  const started = Date.now();
  const result = await runPrismPull({
    onProgress: (scanned) => {
      if (scanned % 10000 === 0) {
        console.log(`  scanned=${scanned}`);
      }
    },
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done in ${seconds}s`);
  console.log(`  scanned:    ${result.scanned}`);
  console.log(`  updated:    ${result.updated}`);
  console.log(`  removed:    ${result.removed}`);
  console.log(`  durationMs: ${result.durationMs}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
