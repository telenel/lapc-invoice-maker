/**
 * Cleanup any test items left over from create-only runs.
 * Hard-deletes anything with barcode TEST-CLAUDE-* (the safety check inside
 * deleteTestItem refuses to touch anything else).
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { deleteTestItem } from "@/domains/product/prism-server";
import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .query<{ SKU: number; BarCode: string }>(
      "SELECT SKU, LTRIM(RTRIM(BarCode)) AS BarCode FROM Item WHERE BarCode LIKE 'TEST-CLAUDE-%'",
    );

  if (result.recordset.length === 0) {
    console.log("Nothing to clean up — no items with TEST-CLAUDE-* barcode.");
    process.exit(0);
  }

  console.log(`Found ${result.recordset.length} test item(s) to clean up:`);
  for (const row of result.recordset) {
    console.log(`  - SKU ${row.SKU}  barcode ${row.BarCode}`);
    try {
      const r = await deleteTestItem(row.SKU);
      console.log(`    deleted (affected ${r.affected})`);
    } catch (err) {
      console.log(`    FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\nCleanup complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
