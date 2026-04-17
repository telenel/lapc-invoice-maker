/**
 * Live batch-create round-trip. Inserts 5 TEST-CLAUDE items in one transaction,
 * verifies they all appear, exercises batch update, then hard-deletes them.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { batchCreateGmItems, batchUpdateItems } from "@/domains/product/prism-batch";
import { deleteTestItem } from "@/domains/product/prism-server";
import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  // Barcode must fit char(20). "TEST-CLAUDE-B-" = 14 chars, leaving 6 for suffix.
  // Use last 5 digits of Date.now() (1–5 chars) plus a 1-digit row index = ≤ 20.
  const stampShort = Date.now() % 100_000;
  const rows = Array.from({ length: 5 }, (_, i) => ({
    description: `BATCH TEST ${i + 1}`,
    vendorId: 21,
    dccId: 1968650,
    itemTaxTypeId: 6,
    barcode: `TEST-CLAUDE-B-${stampShort}${i}`,
    retail: 10 + i,
    cost: 5 + i,
  }));

  // Verify barcode length
  for (const r of rows) {
    if (r.barcode && r.barcode.length > 20) {
      throw new Error(`Barcode too long: ${r.barcode} (${r.barcode.length} chars)`);
    }
  }

  const skus = await batchCreateGmItems(rows);
  console.log(`Created ${skus.length} SKUs:`, skus);

  try {
    const pool = await getPrismPool();
    const req = pool.request();
    const params = skus.map((_, i) => `@s${i}`);
    skus.forEach((s, i) => req.input(`s${i}`, sql.Int, s));
    const result = await req.query<{ SKU: number }>(`SELECT SKU FROM Item WHERE SKU IN (${params.join(", ")})`);
    if (result.recordset.length !== skus.length) {
      throw new Error(`Expected ${skus.length} rows, found ${result.recordset.length}`);
    }
    console.log("✓ all rows visible");

    // Exercise the batch-update path: set every retail to 99.99
    await batchUpdateItems(skus.map((sku) => ({ sku, patch: { retail: 99.99 }, isTextbook: false })));
    const checkReq = pool.request();
    skus.forEach((s, i) => checkReq.input(`s${i}`, sql.Int, s));
    const priced = await checkReq.query<{ SKU: number; Retail: number }>(
      `SELECT i.SKU, inv.Retail FROM Item i JOIN Inventory inv ON i.SKU = inv.SKU AND inv.LocationID = 2 WHERE i.SKU IN (${params.join(", ")})`,
    );
    for (const row of priced.recordset) {
      if (Number(row.Retail) !== 99.99) {
        throw new Error(`Batch update failed for SKU ${row.SKU}: Retail=${row.Retail}`);
      }
    }
    console.log("✓ batch update applied (retail=99.99 on all rows)");
  } finally {
    for (const sku of skus) {
      try { await deleteTestItem(sku); } catch (e) { console.warn(`cleanup ${sku} failed`, e); }
    }
    console.log(`Cleaned up ${skus.length} test items`);
  }
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
