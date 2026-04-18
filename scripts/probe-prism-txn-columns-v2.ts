/**
 * Round 2: validate txn data with corrected assumptions
 *  - fStatus is a bitmask (not 0/1); clean sales are fStatus=1
 *  - ExtPrice is revenue (not SaleAmt, which is near-zero for all rows)
 *  - Check relationships between TranTypeID, fStatus, and money fields
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

const PIERCE = 2;

async function main() {
  const pool = await getPrismPool();

  console.log("=== Header fStatus x TranTypeID cross-tab ===");
  const xtab = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT fStatus, TranTypeID, COUNT(*) AS Rows, AVG(CAST(TranTotal AS FLOAT)) AS AvgTotal
    FROM Transaction_Header
    WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
    GROUP BY fStatus, TranTypeID
    ORDER BY fStatus, TranTypeID
  `);
  console.table(xtab.recordset);

  console.log("=== Characterize fStatus values — sample 3 headers per non-1 status ===");
  for (const status of [2, 4, 8]) {
    const samp = await pool.request().input("loc", sql.Int, PIERCE).input("s", sql.Int, status).query(`
      SELECT TOP 3 TransactionID, TranTypeID, fStatus, fInvoiced, TranTotal, CreateDate, ProcessDate
      FROM Transaction_Header
      WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
        AND fStatus = @s
      ORDER BY ProcessDate DESC
    `);
    console.log(`  fStatus=${status}:`);
    console.table(samp.recordset);
  }

  console.log("=== Verify: ExtPrice behavior on returns (TranTypeID 5 + negative Qty) ===");
  const returnSample = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TOP 5
      th.TransactionID, th.TranTypeID, th.TranTotal,
      td.SKU, td.Qty, td.Price, td.ExtPrice, td.SaleAmt, td.Description
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc
      AND th.ProcessDate >= DATEADD(year, -1, GETDATE())
      AND td.Qty < 0
    ORDER BY th.ProcessDate DESC
  `);
  console.table(returnSample.recordset);

  console.log("=== Revenue by TranTypeID (1y, all fStatus, using ExtPrice) ===");
  const revByType = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT th.TranTypeID, COUNT(*) AS Lines,
           SUM(td.Qty) AS UnitsNet,
           SUM(td.ExtPrice) AS RevNet,
           AVG(CAST(td.ExtPrice AS FLOAT)) AS AvgLine
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -1, GETDATE())
    GROUP BY th.TranTypeID ORDER BY RevNet DESC
  `);
  console.table(revByType.recordset);

  console.log("=== Top 10 Pierce SKUs by 1y units (fStatus=1 only) ===");
  const top = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TOP 10
      td.SKU,
      SUM(td.Qty)                        AS Units1y,
      SUM(td.ExtPrice)                   AS RevenueExtPrice1y,
      COUNT(DISTINCT th.TransactionID)   AS Receipts1y
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc
      AND th.ProcessDate >= DATEADD(year, -1, GETDATE())
      AND th.fStatus = 1
    GROUP BY td.SKU
    ORDER BY SUM(td.Qty) DESC
  `);
  console.table(top.recordset);

  console.log("=== 1y net aggregates with fStatus=1 filter vs no filter ===");
  const compare = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      'fStatus=1 only' AS Scope,
      COUNT(*) AS Lines, SUM(td.Qty) AS UnitsNet, SUM(td.ExtPrice) AS RevExtPrice, COUNT(DISTINCT td.SKU) AS SKUs
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -1, GETDATE())
      AND th.fStatus = 1
    UNION ALL
    SELECT
      'all fStatus' AS Scope,
      COUNT(*), SUM(td.Qty), SUM(td.ExtPrice), COUNT(DISTINCT td.SKU)
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -1, GETDATE())
  `);
  console.table(compare.recordset);

  console.log("=== Spot-check vs Inventory.LastSaleDate for our top-10 1y SKUs ===");
  const matchCheck = await pool.request().input("loc", sql.Int, PIERCE).query(`
    WITH top10 AS (
      SELECT TOP 10 td.SKU, SUM(td.Qty) AS Units1y, MAX(th.ProcessDate) AS LastTxn
      FROM Transaction_Detail td
      INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
      WHERE th.LocationID = @loc
        AND th.ProcessDate >= DATEADD(year, -1, GETDATE())
        AND th.fStatus = 1
      GROUP BY td.SKU ORDER BY SUM(td.Qty) DESC
    )
    SELECT t.SKU, t.Units1y, t.LastTxn, inv.LastSaleDate AS InventoryLastSaleDate
    FROM top10 t
    LEFT JOIN Inventory inv ON inv.SKU = t.SKU AND inv.LocationID = @loc
  `);
  console.table(matchCheck.recordset);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
