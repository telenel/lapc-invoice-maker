/**
 * End-to-end test of the Prism item-management flow.
 *
 * Runs the same code path the API routes use, but without the Next.js shell
 * or auth layer. Useful for validating the integration when the laportal app
 * itself can't be logged into (e.g. missing DATABASE_URL in dev).
 *
 * Usage:
 *   npx tsx scripts/test-prism-flow.ts
 *
 * What it does:
 *   1. Probes Prism reachability
 *   2. Lists vendors/DCCs/tax types (validates lookup queries)
 *   3. Creates a test item with barcode TEST-CLAUDE-001
 *   4. Verifies it via direct SELECT
 *   5. Soft-discontinues it
 *   6. Hard-deletes it (cleanup, only allowed because barcode starts with TEST-CLAUDE-)
 */
// Load .env.local first (matches Next.js dev behavior), then .env as fallback
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { probePrism } from "@/lib/prism";
import {
  createGmItem,
  discontinueItem,
  deleteTestItem,
  listVendors,
  listDccs,
  listTaxTypes,
} from "@/domains/product/prism-server";
import { getPrismPool, sql } from "@/lib/prism";

const TEST_BARCODE = "TEST-CLAUDE-001";

function header(text: string) {
  console.log(`\n========================================`);
  console.log(`  ${text}`);
  console.log(`========================================`);
}

async function main() {
  header("Step 1: Probe Prism reachability");
  const probe = await probePrism();
  console.log("  available:", probe.available);
  if (!probe.available) {
    console.error("  ERROR:", probe.error);
    process.exit(1);
  }
  console.log("  version:", probe.version?.split("\n")[0]);

  header("Step 2: Cleanup any leftover test items from previous runs");
  const pool = await getPrismPool();
  const cleanup = await pool
    .request()
    .input("bc", sql.VarChar, TEST_BARCODE)
    .query<{ SKU: number }>(
      "SELECT SKU FROM Item WHERE BarCode = @bc",
    );
  if (cleanup.recordset.length > 0) {
    console.log(`  Found ${cleanup.recordset.length} leftover test item(s), deleting...`);
    for (const row of cleanup.recordset) {
      try {
        await deleteTestItem(row.SKU);
        console.log(`    deleted SKU ${row.SKU}`);
      } catch (err) {
        console.log(`    couldn't delete SKU ${row.SKU}:`, err instanceof Error ? err.message : err);
      }
    }
  } else {
    console.log("  No leftovers found, clean slate.");
  }

  header("Step 3: List reference data (vendors / DCCs / tax types)");
  const [vendors, dccs, taxTypes] = await Promise.all([
    listVendors(5),
    listDccs(5),
    listTaxTypes(),
  ]);
  console.log("  Top 5 vendors at Pierce:");
  vendors.forEach((v) => console.log(`    ${v.vendorId}: ${v.name}`));
  console.log("  Top 5 DCCs:");
  dccs.forEach((d) => console.log(`    ${d.dccId}: ${d.deptName}${d.className ? ` › ${d.className}` : ""}`));
  console.log("  Tax types:");
  taxTypes.forEach((t) => console.log(`    ${t.taxTypeId}: ${t.description}`));

  header("Step 4: Create a test GM item");
  const created = await createGmItem({
    description: "CLAUDE TEST ITEM — DO NOT KEEP",
    vendorId: 21, // PENS ETC (top Pierce vendor)
    dccId: 1968650, // Most-common Pierce GM DCC
    itemTaxTypeId: 6, // 9.75% CA standard
    barcode: TEST_BARCODE,
    comment: "test",
    retail: 9.99,
    cost: 5.0,
  });
  console.log("  Created:");
  console.log("    SKU:", created.sku);
  console.log("    Description:", created.description);
  console.log("    Barcode:", created.barcode);
  console.log("    Retail:", created.retail);
  console.log("    Cost:", created.cost);

  header("Step 5: Verify item exists end-to-end");
  const verify = await pool
    .request()
    .input("sku", sql.Int, created.sku)
    .query(`
      SELECT
        i.SKU,
        LTRIM(RTRIM(i.BarCode)) AS BarCode,
        i.fDiscontinue,
        LTRIM(RTRIM(gm.Description)) AS Description,
        inv.Retail,
        inv.Cost,
        inv.LocationID,
        l.Abbreviation AS Loc
      FROM Item i
      INNER JOIN GeneralMerchandise gm ON i.SKU = gm.SKU
      LEFT JOIN Inventory inv ON i.SKU = inv.SKU
      LEFT JOIN Location l ON inv.LocationID = l.LocationID
      WHERE i.SKU = @sku
    `);
  console.log("  DB rows for new SKU:");
  console.table(verify.recordset);

  console.log("\n  >>> PAUSE: Open WinPRISM in a separate window, search for SKU", created.sku);
  console.log("  >>>        Confirm it shows the item with the test description, then come back.");
  console.log("  >>>        (Continuing automatically in 20s...)");
  await new Promise((r) => setTimeout(r, 20_000));

  header("Step 6: Soft-discontinue the item");
  const discResult = await discontinueItem(created.sku);
  console.log("  Discontinue affected rows:", discResult.affected);

  // Verify
  const afterDiscRow = await pool
    .request()
    .input("sku", sql.Int, created.sku)
    .query<{ SKU: number; fDiscontinue: number }>(
      "SELECT SKU, fDiscontinue FROM Item WHERE SKU = @sku",
    );
  console.log("  Post-discontinue state:", afterDiscRow.recordset[0]);

  console.log("\n  >>> PAUSE: Refresh WinPRISM and confirm the item is now flagged Discontinued.");
  console.log("  >>>        (Continuing automatically in 15s...)");
  await new Promise((r) => setTimeout(r, 15_000));

  header("Step 7: Hard-delete the test item (cleanup)");
  const delResult = await deleteTestItem(created.sku);
  console.log("  Delete affected rows:", delResult.affected);

  // Verify gone
  const gone = await pool
    .request()
    .input("sku", sql.Int, created.sku)
    .query<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM Item WHERE SKU = @sku",
    );
  console.log("  Rows remaining for that SKU:", gone.recordset[0]?.cnt);

  header("All steps completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[test-prism-flow] FAILED:", err);
  process.exit(1);
});
