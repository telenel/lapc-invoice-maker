/**
 * READ-ONLY. Map out the AP / Purchase Orders domain at Pierce.
 *
 * Strictly SELECT-only against sys.* DMVs and PO_* / Invoice_* / related
 * tables. No INSERT/UPDATE/DELETE/MERGE/EXEC-of-writing-procs/DDL.
 *
 * Answers:
 *   - What PO-related tables exist?
 *   - How many POs total / at Pierce / by year?
 *   - Who creates the most POs (joined to PrismUser.Name)?
 *   - Status distribution
 *   - Top vendors
 *   - PO -> PO_Receive (receipt) -> Invoice_Header pipeline rates
 *   - What PO-related stored procs exist?
 *
 * Usage: npx tsx scripts/probe-prism-purchase-orders.ts
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

async function main() {
  const sections: Section[] = [];

  // 1. PO-related tables and views
  sections.push(
    await runQuery(
      "po_tables_and_views",
      `
      SELECT name, type_desc, create_date, modify_date
      FROM sys.objects
      WHERE type IN ('U', 'V')
        AND (
          name LIKE 'PO[_]%'
          OR name LIKE 'Purch[_]%'
          OR name LIKE '%Purchase%'
          OR name LIKE '%PurchOrder%'
        )
      ORDER BY type_desc, name;
      `,
    ),
  );

  // 2. PO_Header column schema (the canonical PO row)
  sections.push(
    await runQuery(
      "po_header_columns",
      `
      SELECT
          c.column_id,
          c.name AS column_name,
          t.name AS data_type,
          c.max_length,
          c.is_nullable,
          c.is_identity
      FROM sys.columns c
      INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('dbo.PO_Header')
      ORDER BY c.column_id;
      `,
    ),
  );

  // 3. FK inbound — what tables depend on PO_Header
  sections.push(
    await runQuery(
      "po_header_fk_inbound",
      `
      SELECT
          fk.name AS fk_name,
          OBJECT_NAME(fkc.parent_object_id) AS dependent_table,
          c1.name AS dependent_column,
          c2.name AS referenced_column
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns c1 ON c1.object_id = fkc.parent_object_id AND c1.column_id = fkc.parent_column_id
      INNER JOIN sys.columns c2 ON c2.object_id = fkc.referenced_object_id AND c2.column_id = fkc.referenced_column_id
      WHERE fk.referenced_object_id = OBJECT_ID('dbo.PO_Header')
      ORDER BY OBJECT_NAME(fkc.parent_object_id);
      `,
    ),
  );

  // 4. PO_Location columns — to confirm how POs link to locations
  sections.push(
    await runQuery(
      "po_location_columns",
      `
      SELECT c.column_id, c.name AS column_name, t.name AS data_type
      FROM sys.columns c
      INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('dbo.PO_Location')
      ORDER BY c.column_id;
      `,
    ),
  );

  // 5. PO_Status lookup so we can decode fStatus values
  sections.push(
    await runQuery(
      "po_status_lookup",
      `SELECT * FROM PO_Status ORDER BY 1;`,
    ),
  );

  // 6. Total + Pierce-only PO counts (PO_Header has PODate, not CreateDate;
  //    Pierce filter via PO_Location.LocationID since headers aren't loc-bound)
  sections.push(
    await runQuery(
      "po_totals",
      `
      SELECT
          COUNT(*) AS total_pos,
          MIN(PODate) AS first_po,
          MAX(PODate) AS last_po,
          SUM(CASE WHEN PODate >= DATEADD(year, -1, GETDATE()) THEN 1 ELSE 0 END) AS pos_last_12m,
          SUM(CASE WHEN PODate >= DATEADD(day, -30, GETDATE()) THEN 1 ELSE 0 END) AS pos_last_30d
      FROM PO_Header;
      `,
    ),
  );

  // 7. Pierce PO counts (must join PO_Location for location filtering)
  sections.push(
    await runQuery(
      "pierce_po_totals",
      `
      WITH pierce_po_ids AS (
          SELECT DISTINCT d.POID
          FROM PO_Location pl
          INNER JOIN PO_Detail d ON d.POD_ID = pl.POD_ID
          WHERE pl.LocationID IN (2, 3, 4)
      )
      SELECT
          COUNT(*) AS pierce_pos_total,
          SUM(CASE WHEN h.PODate >= DATEADD(year, -1, GETDATE()) THEN 1 ELSE 0 END) AS pierce_pos_last_12m,
          SUM(CASE WHEN h.PODate >= DATEADD(year, -5, GETDATE()) THEN 1 ELSE 0 END) AS pierce_pos_last_5y
      FROM PO_Header h
      INNER JOIN pierce_po_ids p ON p.POID = h.POID;
      `,
    ),
  );

  // 8. POs by year, district + Pierce (last 6 years)
  sections.push(
    await runQuery(
      "pos_by_year",
      `
      WITH pierce_po_ids AS (
          SELECT DISTINCT POID FROM PO_Location WHERE LocationID IN (2, 3, 4)
      )
      SELECT
          YEAR(h.PODate) AS po_year,
          COUNT(*) AS district_count,
          SUM(CASE WHEN h.POID IN (SELECT POID FROM pierce_po_ids) THEN 1 ELSE 0 END) AS pierce_count
      FROM PO_Header h
      WHERE h.PODate >= DATEADD(year, -6, GETDATE())
      GROUP BY YEAR(h.PODate)
      ORDER BY po_year DESC;
      `,
    ),
  );

  // 9. Top users by PO creation, all-time (district-wide)
  sections.push(
    await runQuery(
      "top_users_alltime",
      `
      SELECT TOP 15
          h.UserID,
          RTRIM(u.UserName) AS UserName,
          u.Name AS DisplayName,
          COUNT(*) AS po_count,
          MIN(h.PODate) AS first_po,
          MAX(h.PODate) AS last_po
      FROM PO_Header h
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.UserID
      GROUP BY h.UserID, u.UserName, u.Name
      ORDER BY po_count DESC;
      `,
    ),
  );

  // 10. Top users last 12 months (district-wide)
  sections.push(
    await runQuery(
      "top_users_last_12m",
      `
      SELECT TOP 15
          h.UserID,
          RTRIM(u.UserName) AS UserName,
          u.Name AS DisplayName,
          COUNT(*) AS po_count,
          MAX(h.PODate) AS last_po
      FROM PO_Header h
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.UserID
      WHERE h.PODate >= DATEADD(year, -1, GETDATE())
      GROUP BY h.UserID, u.UserName, u.Name
      ORDER BY po_count DESC;
      `,
    ),
  );

  // 11. Top users at Pierce
  sections.push(
    await runQuery(
      "top_users_pierce",
      `
      WITH pierce_po_ids AS (
          SELECT DISTINCT POID FROM PO_Location WHERE LocationID IN (2, 3, 4)
      )
      SELECT TOP 15
          h.UserID,
          RTRIM(u.UserName) AS UserName,
          u.Name AS DisplayName,
          COUNT(*) AS po_count,
          MIN(h.PODate) AS first_po,
          MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN pierce_po_ids p ON p.POID = h.POID
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.UserID
      GROUP BY h.UserID, u.UserName, u.Name
      ORDER BY po_count DESC;
      `,
    ),
  );

  // 12. Top users at Pierce, last 12 months only
  sections.push(
    await runQuery(
      "top_users_pierce_12m",
      `
      WITH pierce_po_ids AS (
          SELECT DISTINCT POID FROM PO_Location WHERE LocationID IN (2, 3, 4)
      )
      SELECT TOP 15
          h.UserID,
          RTRIM(u.UserName) AS UserName,
          u.Name AS DisplayName,
          COUNT(*) AS po_count,
          MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN pierce_po_ids p ON p.POID = h.POID
      LEFT JOIN prism_security.dbo.PrismUser u ON u.SUID = h.UserID
      WHERE h.PODate >= DATEADD(year, -1, GETDATE())
      GROUP BY h.UserID, u.UserName, u.Name
      ORDER BY po_count DESC;
      `,
    ),
  );

  // 13. PO status distribution at Pierce (last 5 years)
  sections.push(
    await runQuery(
      "pierce_po_status_distribution",
      `
      WITH pierce_po_ids AS (
          SELECT DISTINCT POID FROM PO_Location WHERE LocationID IN (2, 3, 4)
      )
      SELECT
          h.fStatus,
          COUNT(*) AS po_count
      FROM PO_Header h
      INNER JOIN pierce_po_ids p ON p.POID = h.POID
      WHERE h.PODate >= DATEADD(year, -5, GETDATE())
      GROUP BY h.fStatus
      ORDER BY po_count DESC;
      `,
    ),
  );

  // 14. PO -> Receive -> Invoice pipeline at Pierce, last 12 months
  sections.push(
    await runQuery(
      "pierce_po_pipeline_12m",
      `
      WITH pierce_pos AS (
          SELECT DISTINCT d.POID
          FROM PO_Detail d
          INNER JOIN PO_Location pl ON pl.POD_ID = d.POD_ID AND pl.LocationID IN (2, 3, 4)
          INNER JOIN PO_Header h ON h.POID = d.POID
          WHERE h.PODate >= DATEADD(year, -1, GETDATE())
      )
      SELECT
          (SELECT COUNT(*) FROM pierce_pos) AS pierce_pos_12m,
          (SELECT COUNT(DISTINCT POID) FROM PO_Receive r WHERE r.POID IN (SELECT POID FROM pierce_pos)) AS pierce_pos_received,
          (SELECT COUNT(DISTINCT id.PurchaseID) FROM Invoice_Detail id WHERE id.PurchaseID IN (SELECT POID FROM pierce_pos)) AS pierce_pos_invoiced;
      `,
    ),
  );

  // 15. Top Pierce vendors by PO count, last 5 years
  sections.push(
    await runQuery(
      "top_vendors_pierce_5y",
      `
      WITH pierce_po_ids AS (
          SELECT DISTINCT POID FROM PO_Location WHERE LocationID IN (2, 3, 4)
      )
      SELECT TOP 15
          h.VendorID,
          v.Name AS VendorName,
          RTRIM(v.VendorNumber) AS VendorNumber,
          COUNT(*) AS po_count,
          MAX(h.PODate) AS last_po
      FROM PO_Header h
      INNER JOIN pierce_po_ids p ON p.POID = h.POID
      LEFT JOIN VendorMaster v ON v.VendorID = h.VendorID
      WHERE h.PODate >= DATEADD(year, -5, GETDATE())
      GROUP BY h.VendorID, v.Name, v.VendorNumber
      ORDER BY po_count DESC;
      `,
    ),
  );

  // 11. PO-related stored procs (potential write paths)
  sections.push(
    await runQuery(
      "po_procs",
      `
      SELECT name, type_desc, create_date, modify_date
      FROM sys.objects
      WHERE type_desc = 'SQL_STORED_PROCEDURE'
        AND (
          name LIKE 'SP[_]PO[_]%'
          OR name LIKE 'SP[_]Purch%'
          OR name LIKE 'SP[_]AP[_]%'
          OR name LIKE 'P[_]PO[_]%'
          OR name LIKE 'SP[_]%PO%'
        )
      ORDER BY name;
      `,
    ),
  );

  // 12. Recently-executed PO procs (signals what the live system uses)
  sections.push(
    await runQuery(
      "recently_executed_po_procs",
      `
      SELECT TOP 20
          OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
          ps.execution_count,
          ps.last_execution_time,
          ps.last_elapsed_time / 1000 AS last_elapsed_ms
      FROM sys.dm_exec_procedure_stats ps
      WHERE OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP[_]PO[_]%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP[_]Purch%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP[_]AP[_]%'
      ORDER BY ps.last_execution_time DESC;
      `,
    ),
  );

  // 16. Invoice_Header column schema (we need to know the date / location cols)
  sections.push(
    await runQuery(
      "invoice_header_columns",
      `
      SELECT TOP 40 c.column_id, c.name AS column_name, t.name AS data_type
      FROM sys.columns c
      INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('dbo.Invoice_Header')
      ORDER BY c.column_id;
      `,
    ),
  );

  // Print results
  console.log("\n=== Probe summary ===\n");
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
    if (s.rowCount > 30) console.log(`   … (${s.rowCount - 30} more rows)`);
    console.log();
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-purchase-orders-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
