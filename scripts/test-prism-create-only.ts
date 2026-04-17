/**
 * Create a single test item in Prism and STOP.
 * Leaves the item in place so Marcos can verify it in WinPRISM at his own pace.
 *
 * Cleanup is a separate script: scripts/test-prism-cleanup.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem, deleteTestItem } from "@/domains/product/prism-server";
import { getPrismPool, sql } from "@/lib/prism";

const TEST_BARCODE = "TEST-CLAUDE-001";

async function main() {
  // Cleanup any leftover from previous runs first
  const pool = await getPrismPool();
  const leftovers = await pool
    .request()
    .input("bc", sql.VarChar, TEST_BARCODE)
    .query<{ SKU: number }>("SELECT SKU FROM Item WHERE BarCode = @bc");

  for (const row of leftovers.recordset) {
    try {
      await deleteTestItem(row.SKU);
      console.log(`Cleaned up leftover SKU ${row.SKU}`);
    } catch {}
  }

  console.log("Creating test item...");
  const created = await createGmItem({
    description: "CLAUDE TEST ITEM — DO NOT KEEP",
    vendorId: 21,
    dccId: 1968650,
    itemTaxTypeId: 6,
    barcode: TEST_BARCODE,
    comment: "test",
    retail: 9.99,
    cost: 5.0,
  });

  console.log("");
  console.log("============================================================");
  console.log("  ITEM CREATED — verify in WinPRISM");
  console.log("============================================================");
  console.log(`  SKU:          ${created.sku}`);
  console.log(`  Barcode:      ${created.barcode}`);
  console.log(`  Description:  ${created.description}`);
  console.log(`  Retail:       $${created.retail.toFixed(2)}`);
  console.log(`  Cost:         $${created.cost.toFixed(2)}`);
  console.log(`  Location:     PIER (LocationID 2)`);
  console.log("============================================================");
  console.log("");
  console.log("To verify:");
  console.log("  1. Open WinPRISM");
  console.log("  2. Go to Item Maintenance (Ctrl+J 101) or Inventory Maintenance (Ctrl+J 102)");
  console.log(`  3. Search for SKU ${created.sku} or barcode ${TEST_BARCODE}`);
  console.log("");
  console.log("When done verifying, run:");
  console.log("  npx tsx scripts/test-prism-cleanup.ts");
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
