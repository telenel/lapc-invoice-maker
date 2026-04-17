/**
 * Verify that a DCC change via updateGmItem propagates to the shared Item
 * table (district-wide field). Reads DCCID back from Prism and confirms
 * the new value landed. Cleans up after itself.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem } from "@/domains/product/prism-updates";
import { getPrismPool, sql } from "@/lib/prism";

const ORIGINAL_DCC = 1968650;
const ALTERNATE_DCC_QUERY = "SELECT TOP 1 DCCID FROM DeptClassCat WHERE DCCType = 3 AND DCCID <> 1968650";

async function main() {
  const pool = await getPrismPool();
  const altResult = await pool.request().query<{ DCCID: number }>(ALTERNATE_DCC_QUERY);
  const altDcc = altResult.recordset[0]?.DCCID;
  if (!altDcc) throw new Error("Could not find an alternate DCC for the test");

  const item = await createGmItem({
    description: "DISTRICT DCC TEST",
    vendorId: 21,
    dccId: ORIGINAL_DCC,
    itemTaxTypeId: 6,
    barcode: `TEST-CLAUDE-D-${Date.now() % 100_000}`,
    retail: 1,
    cost: 0.5,
  });
  console.log(`Created SKU ${item.sku}`);

  try {
    await updateGmItem(item.sku, { dccId: altDcc });
    const check = await pool.request().input("sku", sql.Int, item.sku)
      .query<{ DCCID: number }>("SELECT DCCID FROM Item WHERE SKU = @sku");
    const actual = check.recordset[0]?.DCCID;
    if (actual !== altDcc) {
      throw new Error(`DCC change did not land: expected ${altDcc}, found ${actual}`);
    }
    console.log(`OK DCC on Item ${item.sku} is now ${actual}`);
  } finally {
    await deleteTestItem(item.sku);
    console.log(`Cleaned up SKU ${item.sku}`);
  }
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
