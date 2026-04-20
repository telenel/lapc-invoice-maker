/**
 * READ-ONLY. Discover the ref table that holds labels for
 * Inventory.StatusCodeID and Textbook.BindingID.
 * No writes.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

async function main() {
  const pool = await getPrismPool();

  console.log("=== candidate status-code tables ===");
  const statusCandidates = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE='BASE TABLE' AND (
      TABLE_NAME LIKE '%Status%Code%' OR
      TABLE_NAME = 'Status_Codes' OR
      TABLE_NAME = 'InventoryStatusCodes' OR
      TABLE_NAME = 'InvStatus'
    )
    ORDER BY TABLE_NAME
  `);
  for (const t of statusCandidates.recordset) {
    console.log(`  ${t.TABLE_NAME}`);
    try {
      const sample = await pool.request().query(`SELECT TOP 5 * FROM [${t.TABLE_NAME}]`);
      for (const r of sample.recordset) console.log("   ", r);
    } catch (err) {
      console.log(`    (read failed: ${err instanceof Error ? err.message : err})`);
    }
  }

  console.log("\n=== candidate binding tables ===");
  const bindingCandidates = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE='BASE TABLE' AND (
      TABLE_NAME LIKE '%Binding%' OR
      TABLE_NAME LIKE 'Textbook_%' OR
      TABLE_NAME LIKE 'TBBinding%'
    )
    ORDER BY TABLE_NAME
  `);
  for (const t of bindingCandidates.recordset) {
    console.log(`  ${t.TABLE_NAME}`);
    try {
      const sample = await pool.request().query(`SELECT TOP 5 * FROM [${t.TABLE_NAME}]`);
      for (const r of sample.recordset) console.log("   ", r);
    } catch (err) {
      console.log(`    (read failed: ${err instanceof Error ? err.message : err})`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
