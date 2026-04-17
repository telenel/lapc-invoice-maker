/**
 * Live edit round-trip: create a TEST-CLAUDE item, update every editable
 * field one at a time, verify each change landed, then hard-delete.
 * Run on the LACCD intranet only.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem, getItemSnapshot } from "@/domains/product/prism-updates";
import { getPrismPool, sql } from "@/lib/prism";

// Must fit in Prism Item.BarCode (char(20)). TEST-CLAUDE-E- is 14 chars,
// leaving 6 for a numeric suffix — modulo 1_000_000 of the current time.
const BARCODE = `TEST-CLAUDE-E-${Date.now() % 1_000_000}`;

async function main() {
  const created = await createGmItem({
    description: "EDIT TEST — ORIGINAL",
    vendorId: 21,
    dccId: 1968650,
    itemTaxTypeId: 6,
    barcode: BARCODE,
    retail: 9.99,
    cost: 5,
  });
  console.log(`Created SKU ${created.sku} with barcode ${BARCODE}`);

  try {
    await updateGmItem(created.sku, { retail: 12.5, cost: 6 });
    const snap1 = await getItemSnapshot(created.sku);
    if (snap1?.retail !== 12.5 || snap1?.cost !== 6) {
      throw new Error(`retail/cost update failed: ${JSON.stringify(snap1)}`);
    }
    console.log("✓ retail + cost updated");

    await updateGmItem(created.sku, { description: "EDIT TEST — UPDATED" });
    const pool = await getPrismPool();
    const desc = await pool.request().input("sku", sql.Int, created.sku).query<{ Description: string }>(
      "SELECT Description FROM GeneralMerchandise WHERE SKU = @sku",
    );
    if (desc.recordset[0]?.Description?.trim() !== "EDIT TEST — UPDATED") {
      throw new Error(`description update failed: ${JSON.stringify(desc.recordset[0])}`);
    }
    console.log("✓ description updated");

    await updateGmItem(created.sku, { comment: "edited" });
    const cmt = await pool.request().input("sku", sql.Int, created.sku).query<{ txComment: string }>(
      "SELECT txComment FROM Item WHERE SKU = @sku",
    );
    if (cmt.recordset[0]?.txComment?.trim() !== "edited") {
      throw new Error(`comment update failed: ${JSON.stringify(cmt.recordset[0])}`);
    }
    console.log("✓ comment updated");

    console.log("All edits verified.");
  } finally {
    await deleteTestItem(created.sku);
    console.log(`Cleaned up SKU ${created.sku}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
