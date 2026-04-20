/**
 * READ-ONLY. For fields with suspiciously high fill rates (TagTypeID, TaxTypeID,
 * StatusCodeID, PackageType, fInvListPriceFlag), pull the actual distribution
 * of values at Pierce locations plus human-readable labels from the reference
 * tables. Answers: "do users ever change these, or is 99% of the fleet on the
 * same default?"
 *
 * Scope: Pierce LocationID IN (2, 3, 4). PBO excluded.
 *
 * Usage: npx tsx scripts/analyze-prism-default-values.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

const PIERCE_LOCS = "2, 3, 4";

async function main() {
  const pool = await getPrismPool();

  // 1. Discover likely reference tables
  console.log("=== Candidate reference tables ===");
  const refTables = await pool.request().query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND (TABLE_NAME LIKE '%Tag%Type%'
        OR TABLE_NAME LIKE '%Status%'
        OR TABLE_NAME LIKE '%Package%'
        OR TABLE_NAME LIKE '%Tax_Type%'
        OR TABLE_NAME LIKE '%PkgType%'
        OR TABLE_NAME LIKE '%Inv_Status%'
        OR TABLE_NAME LIKE 'Item_Tax%')
    ORDER BY TABLE_NAME
  `);
  for (const t of refTables.recordset) console.log(`  ${t.TABLE_NAME}`);

  // 2. Distributions per field at Pierce
  const dists: Array<[string, string]> = [
    ["Inventory.TagTypeID", `
      SELECT TOP 20 inv.TagTypeID AS value, COUNT(*) AS cnt
      FROM Inventory inv
      WHERE inv.LocationID IN (${PIERCE_LOCS})
      GROUP BY inv.TagTypeID
      ORDER BY cnt DESC
    `],
    ["Inventory.TaxTypeID", `
      SELECT TOP 20 inv.TaxTypeID AS value, COUNT(*) AS cnt
      FROM Inventory inv
      WHERE inv.LocationID IN (${PIERCE_LOCS})
      GROUP BY inv.TaxTypeID
      ORDER BY cnt DESC
    `],
    ["Item.ItemTaxTypeID", `
      SELECT TOP 20 i.ItemTaxTypeID AS value, COUNT(*) AS cnt
      FROM Item i
      WHERE EXISTS (SELECT 1 FROM Inventory inv WHERE inv.SKU = i.SKU AND inv.LocationID IN (${PIERCE_LOCS}))
      GROUP BY i.ItemTaxTypeID
      ORDER BY cnt DESC
    `],
    ["Inventory.StatusCodeID", `
      SELECT TOP 20 inv.StatusCodeID AS value, COUNT(*) AS cnt
      FROM Inventory inv
      WHERE inv.LocationID IN (${PIERCE_LOCS})
      GROUP BY inv.StatusCodeID
      ORDER BY cnt DESC
    `],
    ["GeneralMerchandise.PackageType", `
      SELECT TOP 20 LTRIM(RTRIM(g.PackageType)) AS value, COUNT(*) AS cnt
      FROM GeneralMerchandise g
      WHERE EXISTS (SELECT 1 FROM Inventory inv WHERE inv.SKU = g.SKU AND inv.LocationID IN (${PIERCE_LOCS}))
      GROUP BY LTRIM(RTRIM(g.PackageType))
      ORDER BY cnt DESC
    `],
    ["Inventory.fInvListPriceFlag", `
      SELECT TOP 20 inv.fInvListPriceFlag AS value, COUNT(*) AS cnt
      FROM Inventory inv
      WHERE inv.LocationID IN (${PIERCE_LOCS})
      GROUP BY inv.fInvListPriceFlag
      ORDER BY cnt DESC
    `],
  ];

  for (const [label, q] of dists) {
    console.log(`\n=== ${label} distribution (Pierce) ===`);
    const r = await pool.request().query(q);
    let total = 0;
    for (const row of r.recordset) total += row.cnt;
    for (const row of r.recordset) {
      const pct = ((row.cnt / total) * 100).toFixed(1).padStart(5);
      console.log(`  ${pct}%  value=${String(row.value).padEnd(20)}  n=${row.cnt.toLocaleString()}`);
    }
  }

  // 3. Try to pull labels from ref tables we find
  console.log(`\n=== Reference table samples ===`);
  const candidates = [
    { table: "TagType", expectedCols: ["TagTypeID", "Description"] },
    { table: "Tag_Type", expectedCols: ["TagTypeID", "Description"] },
    { table: "Item_Tax_Type", expectedCols: ["ItemTaxTypeID", "Description"] },
    { table: "TaxType", expectedCols: ["TaxTypeID", "Description"] },
    { table: "Tax_Type", expectedCols: ["TaxTypeID", "Description"] },
    { table: "Inventory_Status", expectedCols: ["StatusCodeID", "Description"] },
    { table: "Inv_Status", expectedCols: ["StatusCodeID", "Description"] },
    { table: "InvStatus", expectedCols: ["StatusCodeID", "Description"] },
    { table: "PackageType", expectedCols: ["PackageType", "Description"] },
    { table: "PkgType", expectedCols: ["PkgType", "Description"] },
    { table: "Package_Type", expectedCols: ["PackageType", "Description"] },
  ];

  for (const cand of candidates) {
    const exists = refTables.recordset.some((t) => t.TABLE_NAME.toLowerCase() === cand.table.toLowerCase());
    if (!exists) continue;
    console.log(`\n-- ${cand.table} --`);
    try {
      const cols = await pool.request().query<{ COLUMN_NAME: string }>(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${cand.table}' ORDER BY ORDINAL_POSITION
      `);
      console.log(`  columns: ${cols.recordset.map((c) => c.COLUMN_NAME).join(", ")}`);
      const rows = await pool.request().query(`SELECT TOP 30 * FROM [${cand.table}]`);
      for (const row of rows.recordset) {
        console.log("  ", row);
      }
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
