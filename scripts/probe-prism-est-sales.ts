/**
 * Probe Inventory_EstSales freshness + value distribution.
 * Answers: is Prism still populating this table, and do the values look real?
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  const pool = await getPrismPool();
  const PIERCE = 2;

  const freshness = await pool.request().input("loc", sql.Int, PIERCE).query<{
    TotalRows: number;
    DistinctSKUs: number;
    MinCalc: Date;
    MaxCalc: Date;
    RowsLast30d: number;
    RowsLast90d: number;
    RowsLast365d: number;
  }>(`
    SELECT
      COUNT(*)                                               AS TotalRows,
      COUNT(DISTINCT SKU)                                    AS DistinctSKUs,
      MIN(CalculationDate)                                   AS MinCalc,
      MAX(CalculationDate)                                   AS MaxCalc,
      SUM(CASE WHEN CalculationDate >= DATEADD(day, -30,  GETDATE()) THEN 1 ELSE 0 END) AS RowsLast30d,
      SUM(CASE WHEN CalculationDate >= DATEADD(day, -90,  GETDATE()) THEN 1 ELSE 0 END) AS RowsLast90d,
      SUM(CASE WHEN CalculationDate >= DATEADD(day, -365, GETDATE()) THEN 1 ELSE 0 END) AS RowsLast365d
    FROM Inventory_EstSales
    WHERE LocationID = @loc
  `);
  console.log("== Inventory_EstSales freshness (LocationID=2) ==");
  console.table(freshness.recordset);

  const distByYear = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT YEAR(CalculationDate) AS Yr, COUNT(*) AS Rows
    FROM Inventory_EstSales WHERE LocationID = @loc
    GROUP BY YEAR(CalculationDate) ORDER BY Yr DESC
  `);
  console.log("== Rows by year ==");
  console.table(distByYear.recordset);

  const valueStats = await pool.request().input("loc", sql.Int, PIERCE).query(`
    WITH latest AS (
      SELECT SKU, EstSalesCalc, EstSalesPrev, OneYearSales, LookBackSales,
             LookBackWeeks, SalesToAvgSalesRatio, CurveSource, CalculationDate,
             ROW_NUMBER() OVER (PARTITION BY SKU ORDER BY CalculationDate DESC) AS rn
      FROM Inventory_EstSales WHERE LocationID = @loc
    )
    SELECT
      COUNT(*)                                             AS LatestRows,
      SUM(CASE WHEN EstSalesCalc  = 0 THEN 1 ELSE 0 END)   AS EstCalcZero,
      SUM(CASE WHEN EstSalesCalc  > 0 THEN 1 ELSE 0 END)   AS EstCalcPositive,
      AVG(CAST(EstSalesCalc  AS FLOAT))                    AS EstCalcAvg,
      MAX(EstSalesCalc)                                    AS EstCalcMax,
      SUM(CASE WHEN OneYearSales  > 0 THEN 1 ELSE 0 END)   AS OneYrPositive,
      AVG(CAST(OneYearSales  AS FLOAT))                    AS OneYrAvg,
      SUM(CASE WHEN LookBackSales > 0 THEN 1 ELSE 0 END)   AS LookBackPositive,
      AVG(CAST(LookBackWeeks AS FLOAT))                    AS LookBackWeeksAvg,
      MIN(CalculationDate)                                 AS MinLatestCalc,
      MAX(CalculationDate)                                 AS MaxLatestCalc
    FROM latest WHERE rn = 1
  `);
  console.log("== Latest-per-SKU value stats ==");
  console.table(valueStats.recordset);

  const curves = await pool.request().input("loc", sql.Int, PIERCE).query(`
    WITH latest AS (
      SELECT SKU, CurveSource,
             ROW_NUMBER() OVER (PARTITION BY SKU ORDER BY CalculationDate DESC) AS rn
      FROM Inventory_EstSales WHERE LocationID = @loc
    )
    SELECT CurveSource, COUNT(*) AS Rows FROM latest WHERE rn=1
    GROUP BY CurveSource ORDER BY Rows DESC
  `);
  console.log("== CurveSource distribution (latest per SKU) ==");
  console.table(curves.recordset);

  const sample = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TOP 10 SKU, CalculationDate, EstSalesCalc, EstSalesPrev,
           OneYearSales, LookBackSales, LookBackWeeks, SalesToAvgSalesRatio, CurveSource
    FROM Inventory_EstSales WHERE LocationID = @loc
    ORDER BY CalculationDate DESC, SKU
  `);
  console.log("== 10 most recent rows ==");
  console.table(sample.recordset);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
