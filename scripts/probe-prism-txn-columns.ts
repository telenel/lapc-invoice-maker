/**
 * Validate every Transaction_Header / Transaction_Detail column I proposed
 * for the 3y txn backfill. Report populated %, distinct counts, value ranges,
 * and distribution on categorical fields so we know what's actually usable.
 *
 * Pierce, trailing 3y.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";

const PIERCE = 2;

async function main() {
  const pool = await getPrismPool();

  // --- HEADER COLUMN POPULATION ---
  console.log("=== Transaction_Header column population (Pierce, 3y) ===");
  const hdrPop = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      COUNT(*)                                                                 AS Total,
      SUM(CASE WHEN TranTypeID         IS NOT NULL THEN 1 ELSE 0 END)          AS TranTypeID_populated,
      SUM(CASE WHEN UserID             IS NOT NULL AND UserID <> 0 THEN 1 ELSE 0 END) AS UserID_populated,
      SUM(CASE WHEN POSID              IS NOT NULL THEN 1 ELSE 0 END)          AS POSID_populated,
      SUM(CASE WHEN RegisterID         IS NOT NULL THEN 1 ELSE 0 END)          AS RegisterID_populated,
      SUM(CASE WHEN ReceiptID          IS NOT NULL THEN 1 ELSE 0 END)          AS ReceiptID_populated,
      SUM(CASE WHEN TranNumber         IS NOT NULL THEN 1 ELSE 0 END)          AS TranNumber_populated,
      SUM(CASE WHEN CreateDate         IS NOT NULL THEN 1 ELSE 0 END)          AS CreateDate_populated,
      SUM(CASE WHEN ProcessDate        IS NOT NULL THEN 1 ELSE 0 END)          AS ProcessDate_populated,
      SUM(CASE WHEN TranTotal          IS NOT NULL THEN 1 ELSE 0 END)          AS TranTotal_populated,
      SUM(CASE WHEN TaxTotal           IS NOT NULL THEN 1 ELSE 0 END)          AS TaxTotal_populated,
      SUM(CASE WHEN ItemDiscount       IS NOT NULL THEN 1 ELSE 0 END)          AS ItemDiscount_populated,
      SUM(CASE WHEN TransDiscount      IS NOT NULL THEN 1 ELSE 0 END)          AS TransDiscount_populated,
      SUM(CASE WHEN fStatus            IS NOT NULL THEN 1 ELSE 0 END)          AS fStatus_populated,
      SUM(CASE WHEN fInvoiced          IS NOT NULL THEN 1 ELSE 0 END)          AS fInvoiced_populated
    FROM Transaction_Header
    WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(hdrPop.recordset);

  console.log("=== TranTypeID distribution ===");
  const tranTypeDist = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TranTypeID, COUNT(*) AS Rows
    FROM Transaction_Header
    WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
    GROUP BY TranTypeID ORDER BY Rows DESC
  `);
  console.table(tranTypeDist.recordset);

  console.log("=== fStatus distribution (Header) ===");
  const fStatusHdr = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT fStatus, COUNT(*) AS Rows
    FROM Transaction_Header
    WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
    GROUP BY fStatus ORDER BY Rows DESC
  `);
  console.table(fStatusHdr.recordset);

  console.log("=== fInvoiced distribution (Header) ===");
  const fInvDist = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT fInvoiced, COUNT(*) AS Rows
    FROM Transaction_Header
    WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
    GROUP BY fInvoiced ORDER BY Rows DESC
  `);
  console.table(fInvDist.recordset);

  console.log("=== TranTypeID reference table (if exists) ===");
  try {
    const tt = await pool.request().query(`SELECT * FROM TranType ORDER BY TranTypeID`);
    console.table(tt.recordset);
  } catch {
    console.log("  (no TranType table found — enum meaning not stored in DB)");
  }

  console.log("=== Header money distributions (Pierce, 3y) ===");
  const hdrMoney = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      AVG(CAST(TranTotal     AS FLOAT))  AS AvgTranTotal,
      MIN(TranTotal)                      AS MinTranTotal,
      MAX(TranTotal)                      AS MaxTranTotal,
      SUM(CASE WHEN TranTotal < 0 THEN 1 ELSE 0 END) AS NegativeTranTotalRows,
      SUM(CASE WHEN TranTotal = 0 THEN 1 ELSE 0 END) AS ZeroTranTotalRows,
      AVG(CAST(TaxTotal      AS FLOAT))  AS AvgTaxTotal,
      AVG(CAST(ItemDiscount  AS FLOAT))  AS AvgItemDiscount,
      AVG(CAST(TransDiscount AS FLOAT))  AS AvgTransDiscount
    FROM Transaction_Header
    WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(hdrMoney.recordset);

  console.log("=== CreateDate vs ProcessDate alignment ===");
  const dateSkew = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      SUM(CASE WHEN DATEDIFF(day, CreateDate, ProcessDate) = 0  THEN 1 ELSE 0 END) AS SameDay,
      SUM(CASE WHEN DATEDIFF(day, CreateDate, ProcessDate) BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS Within3Days,
      SUM(CASE WHEN DATEDIFF(day, CreateDate, ProcessDate) > 3  THEN 1 ELSE 0 END) AS MoreThan3Days,
      SUM(CASE WHEN DATEDIFF(day, CreateDate, ProcessDate) < 0  THEN 1 ELSE 0 END) AS ProcessBeforeCreate
    FROM Transaction_Header
    WHERE LocationID = @loc AND ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(dateSkew.recordset);

  // --- DETAIL COLUMN POPULATION ---
  console.log("=== Transaction_Detail column population (Pierce, 3y) ===");
  const dtlPop = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      COUNT(*)                                                                 AS Total,
      SUM(CASE WHEN td.PosLineNumber   IS NOT NULL THEN 1 ELSE 0 END)          AS PosLineNumber_populated,
      SUM(CASE WHEN td.Qty             IS NOT NULL THEN 1 ELSE 0 END)          AS Qty_populated,
      SUM(CASE WHEN td.Price           IS NOT NULL THEN 1 ELSE 0 END)          AS Price_populated,
      SUM(CASE WHEN td.ExtPrice        IS NOT NULL THEN 1 ELSE 0 END)          AS ExtPrice_populated,
      SUM(CASE WHEN td.SaleAmt         IS NOT NULL THEN 1 ELSE 0 END)          AS SaleAmt_populated,
      SUM(CASE WHEN td.DiscountAmt     IS NOT NULL THEN 1 ELSE 0 END)          AS DiscountAmt_populated,
      SUM(CASE WHEN td.MarkDownAmt     IS NOT NULL THEN 1 ELSE 0 END)          AS MarkDownAmt_populated,
      SUM(CASE WHEN td.TaxAmt          IS NOT NULL THEN 1 ELSE 0 END)          AS TaxAmt_populated,
      SUM(CASE WHEN td.MOfNewUsed      IS NOT NULL THEN 1 ELSE 0 END)          AS MOfNewUsed_populated,
      SUM(CASE WHEN td.Description     IS NOT NULL AND LEN(td.Description) > 0 THEN 1 ELSE 0 END) AS Description_populated,
      SUM(CASE WHEN td.fStatus         IS NOT NULL THEN 1 ELSE 0 END)          AS fStatus_populated,
      SUM(CASE WHEN td.CreateDate      IS NOT NULL THEN 1 ELSE 0 END)          AS CreateDate_populated,
      SUM(CASE WHEN td.SKU             IS NOT NULL AND td.SKU > 0 THEN 1 ELSE 0 END) AS SKU_populated
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(dtlPop.recordset);

  console.log("=== Detail money distributions ===");
  const dtlMoney = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT
      AVG(CAST(td.Qty AS FLOAT))                                   AS AvgQty,
      MIN(td.Qty)                                                   AS MinQty,
      MAX(td.Qty)                                                   AS MaxQty,
      SUM(CASE WHEN td.Qty < 0 THEN 1 ELSE 0 END)                   AS NegativeQtyRows,
      SUM(CASE WHEN td.Qty = 0 THEN 1 ELSE 0 END)                   AS ZeroQtyRows,
      AVG(CAST(td.SaleAmt AS FLOAT))                                AS AvgSaleAmt,
      MIN(td.SaleAmt)                                               AS MinSaleAmt,
      MAX(td.SaleAmt)                                               AS MaxSaleAmt,
      SUM(CASE WHEN td.SaleAmt < 0 THEN 1 ELSE 0 END)               AS NegativeSaleAmtRows,
      AVG(CAST(td.ExtPrice AS FLOAT))                               AS AvgExtPrice,
      AVG(CAST(td.DiscountAmt AS FLOAT))                            AS AvgDiscountAmt,
      AVG(CAST(td.MarkDownAmt AS FLOAT))                            AS AvgMarkDownAmt
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -3, GETDATE())
  `);
  console.table(dtlMoney.recordset);

  console.log("=== fStatus distribution (Detail) ===");
  const dtlStatus = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT td.fStatus, COUNT(*) AS Rows
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -3, GETDATE())
    GROUP BY td.fStatus ORDER BY Rows DESC
  `);
  console.table(dtlStatus.recordset);

  console.log("=== MOfNewUsed distribution ===");
  const nuDist = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT td.MOfNewUsed, COUNT(*) AS Rows
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -3, GETDATE())
    GROUP BY td.MOfNewUsed ORDER BY Rows DESC
  `);
  console.table(nuDist.recordset);

  console.log("=== Sanity: 5 sample non-void detail rows ===");
  const sample = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TOP 5
      th.TransactionID, th.TranTypeID, th.UserID, th.POSID, th.RegisterID,
      th.CreateDate AS HdrCreateDate, th.ProcessDate, th.TranTotal, th.fStatus AS HdrStatus, th.fInvoiced,
      td.TranDtlID, td.SKU, td.PosLineNumber, td.Qty, td.Price, td.ExtPrice, td.SaleAmt,
      td.DiscountAmt, td.MarkDownAmt, td.TaxAmt, td.MOfNewUsed, td.Description, td.fStatus AS DtlStatus,
      td.CreateDate AS DtlCreateDate
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc AND th.ProcessDate >= DATEADD(year, -3, GETDATE())
      AND th.fStatus = 0 AND td.fStatus = 0
    ORDER BY th.ProcessDate DESC
  `);
  console.table(sample.recordset);

  console.log("=== Sanity: aggregate sense-check — top 10 Pierce SKUs by 1y units sold ===");
  const top = await pool.request().input("loc", sql.Int, PIERCE).query(`
    SELECT TOP 10
      td.SKU,
      SUM(td.Qty)                        AS Units1y,
      SUM(td.SaleAmt)                    AS Revenue1y,
      COUNT(DISTINCT th.TransactionID)    AS Receipts1y
    FROM Transaction_Detail td
    INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
    WHERE th.LocationID = @loc
      AND th.ProcessDate >= DATEADD(year, -1, GETDATE())
      AND th.fStatus = 0 AND td.fStatus = 0
    GROUP BY td.SKU
    ORDER BY SUM(td.Qty) DESC
  `);
  console.table(top.recordset);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
