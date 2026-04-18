/**
 * Probe Pierce transaction volume for the last 3 years.
 * Answers: raw row counts for Transaction_Header/Detail, SalesHistory rollup,
 * ForecastItemSalesByWeek — to size a Prism → Supabase pull.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

const PIERCE = 2;

async function main() {
  const pool = await getPrismPool();

  console.log("=== Transaction_Header, Pierce, trailing 3y ===");
  const thdr = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      COUNT(*)                                          AS Rows3y,
      MIN(ProcessDate)                                  AS Earliest,
      MAX(ProcessDate)                                  AS Latest,
      COUNT(DISTINCT CAST(ProcessDate AS DATE))         AS DistinctDays
    FROM Transaction_Header
    WHERE LocationID = @loc
      AND ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(thdr.recordset);

  console.log("=== Transaction_Detail, Pierce, trailing 3y ===");
  const tdtl = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      COUNT(*)                                          AS Rows3y,
      COUNT(DISTINCT td.SKU)                            AS DistinctSKUs,
      AVG(CAST(td.Qty AS FLOAT))                        AS AvgQty
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th
      ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc
      AND th.ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(tdtl.recordset);

  console.log("=== Per-year volume ===");
  const byYear = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      YEAR(th.ProcessDate)   AS Yr,
      COUNT(DISTINCT th.TransactionID)  AS TxnHeaders,
      COUNT(*)                           AS DetailLines
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th
      ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc
      AND th.ProcessDate >= DATEADD(year, -5, GETDATE())
    GROUP BY YEAR(th.ProcessDate)
    ORDER BY Yr DESC
  `);
  console.table(byYear.recordset);

  console.log("=== SalesHistoryDetail (pre-aggregated rollup) Pierce 3y ===");
  const shd = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      COUNT(*)                              AS Rows3y,
      COUNT(DISTINCT shd.SKU)               AS DistinctSKUs
    FROM SalesHistoryDetail shd
    INNER JOIN SalesHistoryHeader shh
      ON shh.SHMID = shd.SHMID
    WHERE shh.LocationID = @loc
      AND shh.PostDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(shd.recordset);

  console.log("=== ForecastItemSalesByWeek Pierce, all history ===");
  const fw = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      COUNT(*)                                           AS Rows,
      COUNT(DISTINCT SKU)                                AS DistinctSKUs,
      MIN(PostWeek)                                      AS Earliest,
      MAX(PostWeek)                                      AS Latest
    FROM ForecastItemSalesByWeek
    WHERE LocationID = @loc
  `);
  console.table(fw.recordset);

  console.log("=== Sample of ForecastItemSalesByWeek ===");
  const fwSample = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TOP 10 SKU, LocationID, DCCID, PostWeek, SaleQty
    FROM ForecastItemSalesByWeek
    WHERE LocationID = @loc
    ORDER BY PostWeek DESC
  `);
  console.table(fwSample.recordset);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
