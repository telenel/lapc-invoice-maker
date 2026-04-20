/**
 * Read-only discovery: list every row in the Prism Location master so we know
 * which LocationIDs actually correspond to Pierce, what they're called, and
 * which ones are still in active use (have any Inventory rows, any recent
 * transactions, etc).
 *
 * Usage: npx tsx scripts/analyze-prism-locations.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  const pool = await getPrismPool();

  // First: discover which columns exist on Location — we don't know the exact
  // shape. Pull the column list.
  const cols = await pool.request().query<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
  }>(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Location'
    ORDER BY ORDINAL_POSITION
  `);
  console.log("\n=== Location columns ===");
  for (const c of cols.recordset) {
    console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
  }

  // Next: dump every Location row
  const rows = await pool.request().query(`SELECT * FROM Location ORDER BY LocationID`);
  console.log(`\n=== All Location rows (${rows.recordset.length}) ===`);
  for (const r of rows.recordset) {
    console.log(r);
  }

  // Discover Transaction_Header columns so we use the right date field
  const thCols = await pool.request().query<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
  }>(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Transaction_Header'
    ORDER BY ORDINAL_POSITION
  `);
  console.log("\n=== Transaction_Header columns ===");
  for (const c of thCols.recordset) {
    console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
  }

  // For each location, count Inventory rows and recent transactions
  // (date column discovered above — adjust the next query's column name to match)
  console.log(`\n=== Inventory rows per location ===`);
  const inv = await pool.request().query<{
    LocationID: number;
    inv_rows: number;
    distinct_skus: number;
  }>(`
    SELECT l.LocationID,
           COUNT(*) AS inv_rows,
           COUNT(DISTINCT inv.SKU) AS distinct_skus
    FROM Location l
    LEFT JOIN Inventory inv ON inv.LocationID = l.LocationID
    GROUP BY l.LocationID
    ORDER BY l.LocationID
  `);
  for (const a of inv.recordset) {
    console.log(`  LocationID ${a.LocationID}: inv_rows=${a.inv_rows?.toLocaleString() ?? 0}, distinctSkus=${a.distinct_skus?.toLocaleString() ?? 0}`);
  }
  const activity = { recordset: [] };
  for (const a of activity.recordset) {
    console.log(`  LocationID ${a.LocationID}: inv=${a.inv_rows.toLocaleString()} skus, distinctSkus=${a.distinct_skus.toLocaleString()}, lastTxn=${a.last_txn?.toISOString() ?? 'never'}, txns90d=${a.txns_last_90d}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
