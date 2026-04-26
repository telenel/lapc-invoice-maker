/**
 * READ-ONLY. Comprehensive Pierce-only PO + AP analytics.
 *
 * Pierce filter: a PO is "Pierce" if any of its detail rows has a
 * PO_Location row with LocationID IN (2, 3, 4) (PIER, PCOP, PFS).
 *
 * Strictly SELECT-only against Prism tables and sys.* DMVs. No writes,
 * no DDL, no proc EXECs.
 *
 * Usage: npx tsx scripts/probe-prism-pierce-purchase-orders.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

type Section = { name: string; rowCount: number; rows: unknown[]; errored?: string };

async function runQuery(label: string, query: string, params: { name: string; value: unknown }[] = []): Promise<Section> {
  const pool = await getPrismPool();
  const req = pool.request();
  for (const p of params) req.input(p.name, p.value);
  try {
    const r = await req.query(query);
    return { name: label, rowCount: r.recordset.length, rows: r.recordset };
  } catch (err) {
    return { name: label, rowCount: 0, rows: [], errored: err instanceof Error ? err.message : String(err) };
  }
}

function trunc(s: unknown, max = 200): string {
  if (s === null || s === undefined) return "<null>";
  return String(s).replace(/\s+/g, " ").trim().slice(0, max);
}

// Reusable Pierce-PO subquery. Embed as `(${PIERCE_PO_IDS_SUBQUERY})` in WHERE clauses.
const PIERCE_PO_IDS_SUBQUERY = `
  SELECT DISTINCT d.POID
  FROM PO_Detail d
  INNER JOIN PO_Location pl ON pl.POD_ID = d.POD_ID
  WHERE pl.LocationID IN (2, 3, 4)
`;

async function main() {
  const sections: Section[] = [];

  // ---------- A. Schema discovery ----------

  sections.push(
    await runQuery(
      "po_detail_columns",
      `SELECT c.column_id, c.name AS column_name, t.name AS data_type, c.max_length, c.is_nullable
       FROM sys.columns c INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
       WHERE c.object_id = OBJECT_ID('dbo.PO_Detail') ORDER BY c.column_id`,
    ),
  );

  sections.push(
    await runQuery(
      "vendormaster_money_cols",
      `SELECT c.name AS column_name, t.name AS data_type
       FROM sys.columns c INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
       WHERE c.object_id = OBJECT_ID('dbo.VendorMaster')
         AND (t.name IN ('money', 'decimal', 'numeric') OR c.name LIKE '%Name%' OR c.name LIKE '%Number%')
       ORDER BY c.column_id`,
    ),
  );

  // ---------- B. Pierce overall counts and trend ----------

  sections.push(
    await runQuery(
      "pierce_totals",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT
        (SELECT COUNT(*) FROM p) AS pierce_pos_total,
        (SELECT COUNT(*) FROM PO_Header h INNER JOIN p ON p.POID = h.POID
           WHERE h.PODate >= DATEADD(year, -1, GETDATE())) AS pierce_pos_last_12m,
        (SELECT COUNT(*) FROM PO_Header h INNER JOIN p ON p.POID = h.POID
           WHERE h.PODate >= DATEADD(month, -3, GETDATE())) AS pierce_pos_last_3m,
        (SELECT COUNT(*) FROM PO_Header h INNER JOIN p ON p.POID = h.POID
           WHERE h.PODate >= DATEADD(day, -30, GETDATE())) AS pierce_pos_last_30d,
        (SELECT MIN(h.PODate) FROM PO_Header h INNER JOIN p ON p.POID = h.POID) AS first_pierce_po,
        (SELECT MAX(h.PODate) FROM PO_Header h INNER JOIN p ON p.POID = h.POID) AS last_pierce_po
      `,
    ),
  );

  sections.push(
    await runQuery(
      "pierce_pos_by_year",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY}),
      pierce_h AS (
        SELECT h.POID, h.PODate
        FROM PO_Header h
        INNER JOIN p ON p.POID = h.POID
        WHERE h.PODate >= DATEADD(year, -8, GETDATE())
          AND YEAR(h.PODate) BETWEEN 2018 AND 2026
      )
      SELECT YEAR(PODate) AS po_year, COUNT(*) AS pierce_po_count
      FROM pierce_h
      GROUP BY YEAR(PODate)
      ORDER BY po_year DESC
      `,
    ),
  );

  sections.push(
    await runQuery(
      "pierce_pos_by_month_12m",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY}),
      pierce_h AS (
        SELECT h.PODate
        FROM PO_Header h
        INNER JOIN p ON p.POID = h.POID
        WHERE h.PODate >= DATEADD(month, -12, GETDATE())
      )
      SELECT
        FORMAT(PODate, 'yyyy-MM') AS po_month,
        COUNT(*) AS pierce_po_count
      FROM pierce_h
      GROUP BY FORMAT(PODate, 'yyyy-MM')
      ORDER BY po_month DESC
      `,
    ),
  );

  sections.push(
    await runQuery(
      "pierce_status_distribution_5y",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT
        h.fStatus,
        ps.Description AS status_desc,
        COUNT(*) AS po_count
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      LEFT JOIN PO_Status ps ON ps.POStatus = h.fStatus
      WHERE h.PODate >= DATEADD(year, -5, GETDATE())
      GROUP BY h.fStatus, ps.Description
      ORDER BY po_count DESC
      `,
    ),
  );

  // ---------- C. Pierce user activity ----------

  sections.push(
    await runQuery(
      "pierce_top_users_alltime",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT TOP 20
        h.UserID,
        RTRIM(u.UserName) AS UserName,
        u.Name AS DisplayName,
        COUNT(*) AS po_count,
        MIN(h.PODate) AS first_po,
        MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.UserID
      GROUP BY h.UserID, u.UserName, u.Name
      ORDER BY po_count DESC
      `,
    ),
  );

  sections.push(
    await runQuery(
      "pierce_top_users_last_12m",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT TOP 20
        h.UserID,
        RTRIM(u.UserName) AS UserName,
        u.Name AS DisplayName,
        COUNT(*) AS po_count,
        MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.UserID
      WHERE h.PODate >= DATEADD(year, -1, GETDATE())
      GROUP BY h.UserID, u.UserName, u.Name
      ORDER BY po_count DESC
      `,
    ),
  );

  sections.push(
    await runQuery(
      "pierce_top_users_last_30d",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT TOP 15
        h.UserID,
        RTRIM(u.UserName) AS UserName,
        u.Name AS DisplayName,
        COUNT(*) AS po_count,
        MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.UserID
      WHERE h.PODate >= DATEADD(day, -30, GETDATE())
      GROUP BY h.UserID, u.UserName, u.Name
      ORDER BY po_count DESC
      `,
    ),
  );

  // BuyerID is separate from UserID — buyer-of-record vs creating-user
  sections.push(
    await runQuery(
      "pierce_top_buyers_last_12m",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT TOP 15
        h.BuyerID,
        RTRIM(u.UserName) AS BuyerUserName,
        u.Name AS BuyerName,
        COUNT(*) AS po_count
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.BuyerID
      WHERE h.PODate >= DATEADD(year, -1, GETDATE())
      GROUP BY h.BuyerID, u.UserName, u.Name
      ORDER BY po_count DESC
      `,
    ),
  );

  // Stella's profile (SUID 911) — Pierce employee
  sections.push(
    await runQuery(
      "stella_pierce_profile",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT
        COUNT(*) AS pierce_pos,
        MIN(h.PODate) AS first_pierce_po,
        MAX(h.PODate) AS last_pierce_po,
        SUM(CASE WHEN h.PODate >= DATEADD(year, -1, GETDATE()) THEN 1 ELSE 0 END) AS pos_last_12m,
        SUM(CASE WHEN h.PODate >= DATEADD(day, -30, GETDATE()) THEN 1 ELSE 0 END) AS pos_last_30d,
        SUM(CASE WHEN h.fStatus = 0 THEN 1 ELSE 0 END) AS proposed_count,
        SUM(CASE WHEN h.fStatus = 1 THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN h.fStatus = 2 THEN 1 ELSE 0 END) AS closed_count
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      WHERE h.UserID = 911
      `,
    ),
  );

  // Michael Matsumoto profile (SUID 191) — Pierce employee
  sections.push(
    await runQuery(
      "michael_pierce_profile",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT
        COUNT(*) AS pierce_pos,
        MIN(h.PODate) AS first_pierce_po,
        MAX(h.PODate) AS last_pierce_po,
        SUM(CASE WHEN h.PODate >= DATEADD(year, -1, GETDATE()) THEN 1 ELSE 0 END) AS pos_last_12m,
        SUM(CASE WHEN h.PODate >= DATEADD(day, -30, GETDATE()) THEN 1 ELSE 0 END) AS pos_last_30d,
        SUM(CASE WHEN h.fStatus = 0 THEN 1 ELSE 0 END) AS proposed_count,
        SUM(CASE WHEN h.fStatus = 1 THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN h.fStatus = 2 THEN 1 ELSE 0 END) AS closed_count
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      WHERE h.UserID = 191
      `,
    ),
  );

  // ---------- D. Vendors at Pierce ----------

  sections.push(
    await runQuery(
      "pierce_top_vendors_alltime",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT TOP 25
        h.VendorID,
        RTRIM(v.Name) AS VendorName,
        COUNT(*) AS po_count,
        MIN(h.PODate) AS first_po,
        MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      LEFT JOIN VendorMaster v ON v.VendorID = h.VendorID
      GROUP BY h.VendorID, v.Name
      ORDER BY po_count DESC
      `,
    ),
  );

  sections.push(
    await runQuery(
      "pierce_top_vendors_last_12m",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT TOP 25
        h.VendorID,
        RTRIM(v.Name) AS VendorName,
        COUNT(*) AS po_count,
        MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      LEFT JOIN VendorMaster v ON v.VendorID = h.VendorID
      WHERE h.PODate >= DATEADD(year, -1, GETDATE())
      GROUP BY h.VendorID, v.Name
      ORDER BY po_count DESC
      `,
    ),
  );

  // Top vendors at Pierce by line-item dollar value (Cost * TotalQty)
  sections.push(
    await runQuery(
      "pierce_top_vendors_by_spend_5y",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY}),
      pierce_lines AS (
        SELECT h.VendorID, d.Cost * d.TotalQty AS line_value
        FROM PO_Header h
        INNER JOIN p ON p.POID = h.POID
        INNER JOIN PO_Detail d ON d.POID = h.POID
        WHERE h.PODate >= DATEADD(year, -5, GETDATE())
          AND d.Cost IS NOT NULL AND d.TotalQty IS NOT NULL
      )
      SELECT TOP 20
        pl.VendorID,
        RTRIM(v.Name) AS VendorName,
        SUM(pl.line_value) AS total_spend_5y,
        COUNT(*) AS line_count
      FROM pierce_lines pl
      LEFT JOIN VendorMaster v ON v.VendorID = pl.VendorID
      GROUP BY pl.VendorID, v.Name
      ORDER BY total_spend_5y DESC
      `,
    ),
  );

  // ---------- E. Pipeline analytics ----------

  // Pipeline by year — Pierce — using flags pre-computed in CTE so outer
  // aggregations don't nest a subquery inside SUM().
  sections.push(
    await runQuery(
      "pierce_pipeline_by_year",
      `
      WITH pierce_pos AS (
        SELECT DISTINCT h.POID, YEAR(h.PODate) AS po_year
        FROM PO_Header h
        INNER JOIN PO_Detail d ON d.POID = h.POID
        INNER JOIN PO_Location pl ON pl.POD_ID = d.POD_ID AND pl.LocationID IN (2, 3, 4)
        WHERE h.PODate >= DATEADD(year, -5, GETDATE())
      ),
      flagged AS (
        SELECT
          pp.po_year,
          pp.POID,
          CASE WHEN EXISTS (SELECT 1 FROM PO_Receive r WHERE r.POID = pp.POID) THEN 1 ELSE 0 END AS received_flag,
          CASE WHEN EXISTS (SELECT 1 FROM Invoice_Detail id WHERE id.PurchaseID = pp.POID) THEN 1 ELSE 0 END AS invoiced_flag
        FROM pierce_pos pp
      )
      SELECT
        po_year,
        COUNT(*) AS pos_created,
        SUM(received_flag) AS pos_received,
        SUM(invoiced_flag) AS pos_invoiced
      FROM flagged
      GROUP BY po_year
      ORDER BY po_year DESC
      `,
    ),
  );

  // Time from PO creation to receive — use PO_Header.ReceiveDate (the latest
  // receive date) since PO_Receive's date column wasn't where we expected.
  sections.push(
    await runQuery(
      "pierce_receive_lag_distribution",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY}),
      lags AS (
        SELECT DATEDIFF(day, h.PODate, h.ReceiveDate) AS lag_days
        FROM PO_Header h
        INNER JOIN p ON p.POID = h.POID
        WHERE h.PODate >= DATEADD(year, -1, GETDATE())
          AND h.ReceiveDate IS NOT NULL
      )
      SELECT
        COUNT(*) AS n,
        AVG(CAST(lag_days AS FLOAT)) AS avg_lag_days,
        MIN(lag_days) AS min_lag_days,
        MAX(lag_days) AS max_lag_days,
        SUM(CASE WHEN lag_days <= 7 THEN 1 ELSE 0 END) AS within_7_days,
        SUM(CASE WHEN lag_days <= 14 THEN 1 ELSE 0 END) AS within_14_days,
        SUM(CASE WHEN lag_days <= 30 THEN 1 ELSE 0 END) AS within_30_days,
        SUM(CASE WHEN lag_days > 30 THEN 1 ELSE 0 END) AS more_than_30_days,
        SUM(CASE WHEN lag_days < 0 THEN 1 ELSE 0 END) AS received_before_PODate
      FROM lags
      `,
    ),
  );

  // BackOrderQty / CancelQty exposure for Pierce, last 12m
  sections.push(
    await runQuery(
      "pierce_backorder_cancel_summary",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT
        COUNT(DISTINCT pl.POD_ID) AS pierce_po_lines,
        SUM(pl.Qty) AS total_ordered_qty,
        SUM(pl.RecvQty) AS total_received_qty,
        SUM(pl.BackOrderQty) AS total_backorder_qty,
        SUM(pl.CancelQty) AS total_cancel_qty,
        SUM(pl.InvoicedQty) AS total_invoiced_qty,
        SUM(pl.DiscrQty) AS total_discrepancy_qty,
        SUM(CASE WHEN pl.BackOrderQty > 0 THEN 1 ELSE 0 END) AS lines_with_backorder,
        SUM(CASE WHEN pl.CancelQty > 0 THEN 1 ELSE 0 END) AS lines_with_cancel
      FROM PO_Location pl
      INNER JOIN PO_Detail d ON d.POD_ID = pl.POD_ID
      INNER JOIN PO_Header h ON h.POID = d.POID
      WHERE pl.LocationID IN (2, 3, 4)
        AND h.PODate >= DATEADD(year, -1, GETDATE())
      `,
    ),
  );

  // Average PO size + top items at Pierce
  sections.push(
    await runQuery(
      "pierce_avg_po_size_5y",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY}),
      sizes AS (
        SELECT
          h.POID,
          (SELECT COUNT(*) FROM PO_Detail d WHERE d.POID = h.POID) AS line_count,
          (SELECT SUM(d.TotalQty) FROM PO_Detail d WHERE d.POID = h.POID) AS total_qty,
          (SELECT SUM(d.Cost * d.TotalQty) FROM PO_Detail d WHERE d.POID = h.POID) AS po_value
        FROM PO_Header h
        INNER JOIN p ON p.POID = h.POID
        WHERE h.PODate >= DATEADD(year, -5, GETDATE())
      )
      SELECT
        COUNT(*) AS n_pos,
        AVG(CAST(line_count AS FLOAT)) AS avg_lines_per_po,
        AVG(CAST(total_qty AS FLOAT)) AS avg_qty_per_po,
        AVG(po_value) AS avg_po_value,
        SUM(po_value) AS total_spend_5y
      FROM sizes
      `,
    ),
  );

  sections.push(
    await runQuery(
      "pierce_top_skus_12m",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY}),
      pierce_lines AS (
        SELECT d.SKU, d.TotalQty, d.Cost
        FROM PO_Header h
        INNER JOIN p ON p.POID = h.POID
        INNER JOIN PO_Detail d ON d.POID = h.POID
        WHERE h.PODate >= DATEADD(year, -1, GETDATE())
      )
      SELECT TOP 20
        pl.SKU,
        RTRIM(im.Description) AS Description,
        SUM(pl.TotalQty) AS total_qty,
        SUM(pl.Cost * pl.TotalQty) AS total_spend,
        COUNT(*) AS line_count
      FROM pierce_lines pl
      LEFT JOIN ItemMaster im ON im.SKU = pl.SKU
      GROUP BY pl.SKU, im.Description
      ORDER BY total_spend DESC
      `,
    ),
  );

  // ---------- F. Spend / dollar value ----------

  sections.push(
    await runQuery(
      "pierce_spend_summary_5y",
      `
      WITH p AS (${PIERCE_PO_IDS_SUBQUERY})
      SELECT
        YEAR(h.PODate) AS po_year,
        COUNT(DISTINCT h.POID) AS pos_count,
        SUM(h.Coop) AS total_coop_dollars
      FROM PO_Header h
      INNER JOIN p ON p.POID = h.POID
      WHERE h.PODate >= DATEADD(year, -5, GETDATE())
      GROUP BY YEAR(h.PODate)
      ORDER BY po_year DESC
      `,
    ),
  );

  // ---------- G. Auto-generation usage ----------

  sections.push(
    await runQuery(
      "po_autogen_proc_stats",
      `
      SELECT TOP 20
        OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
        ps.execution_count,
        ps.last_execution_time
      FROM sys.dm_exec_procedure_stats ps
      WHERE OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP[_]Autogen%PO%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'P[_]Autogen%PO%'
      ORDER BY ps.last_execution_time DESC
      `,
    ),
  );

  // ---------- H. Print results ----------

  console.log("\n=== Pierce Purchase Orders Probe ===\n");
  for (const s of sections) {
    const tag = s.errored ? "ERRORED" : `rows=${s.rowCount}`;
    console.log(`[${s.name}]  ${tag}`);
    if (s.errored) {
      console.log(`   ! ${trunc(s.errored, 200)}`);
      continue;
    }
    if (s.rowCount === 0) {
      console.log("   (no rows)");
      continue;
    }
    const sample = s.rows.slice(0, 30);
    for (const r of sample as Record<string, unknown>[]) {
      const cols = Object.entries(r)
        .map(([k, v]) => `${k}=${trunc(v, 100)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 30) console.log(`   … (${s.rowCount - 30} more rows in JSON)`);
    console.log();
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-pierce-purchase-orders-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
