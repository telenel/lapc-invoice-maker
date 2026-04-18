/**
 * Live test of runPrismPull. Runs it twice; the second run must upsert
 * zero rows (idempotency). Reports timing.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { runPrismPull } from "@/domains/product/prism-sync";

async function main() {
  console.log("First run:");
  const r1 = await runPrismPull({ onProgress: (n) => { if (n % 5000 === 0) console.log(`  scanned ${n}`); } });
  console.log(`  scanned=${r1.scanned}, updated=${r1.updated}, removed=${r1.removed}, durationMs=${r1.durationMs}`);

  console.log("Second run (expect 0 updated, 0 removed):");
  const r2 = await runPrismPull();
  console.log(`  scanned=${r2.scanned}, updated=${r2.updated}, removed=${r2.removed}, durationMs=${r2.durationMs}`);

  if (r2.updated !== 0 || r2.removed !== 0) {
    console.error(`IDEMPOTENCY FAIL: second run updated=${r2.updated} removed=${r2.removed} (expected 0/0)`);
    process.exit(1);
  }
  console.log("OK idempotent");
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
