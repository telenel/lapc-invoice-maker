/**
 * READ-ONLY. Find the proc(s) that produce AR invoice data for the
 * Crystal Reports viewer when a user clicks "Print" / "Open" on an invoice.
 *
 * Strategy:
 *  1. Catalog scan for RPT_*, *Invoice*, *Print* procs.
 *  2. Procedure-stats: which of those have run recently (signal: actually used).
 *  3. Plan-cache body recovery for the most-likely candidates.
 *
 * Strictly SELECT-only against sys.* DMVs and catalog views.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

type Section = { name: string; rowCount: number; rows: unknown[]; errored?: string; elapsedMs?: number };

async function runQuery(label: string, query: string, timeoutMs = 60_000): Promise<Section> {
  const pool = await getPrismPool();
  const req = pool.request();
  (req as unknown as { timeout: number }).timeout = timeoutMs;
  const t0 = Date.now();
  try {
    const r = await req.query(query);
    return { name: label, rowCount: r.recordset.length, rows: r.recordset, elapsedMs: Date.now() - t0 };
  } catch (err) {
    return {
      name: label,
      rowCount: 0,
      rows: [],
      errored: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - t0,
    };
  }
}

function trunc(s: unknown, max = 200): string {
  if (s === null || s === undefined) return "<null>";
  return String(s).replace(/\s+/g, " ").trim().slice(0, max);
}

async function main() {
  const sections: Section[] = [];

  // 1. Catalog of any proc whose name suggests invoice reporting
  sections.push(
    await runQuery(
      "catalog_invoice_report_procs",
      `
      SELECT name, type_desc, create_date, modify_date
      FROM sys.objects
      WHERE type_desc = 'SQL_STORED_PROCEDURE'
        AND (
          name LIKE 'RPT_%ARInvoice%'
          OR name LIKE 'RPT_%Invoice%'
          OR name LIKE 'SP_RPT_%Invoice%'
          OR name LIKE 'SP_%InvoicePrint%'
          OR name LIKE 'SP_%PrintInvoice%'
          OR name LIKE 'SP_%InvoiceReport%'
          OR name LIKE 'SP_AR%Print%'
        )
      ORDER BY name;
      `,
      30_000,
    ),
  );

  // 2. Execution stats — which of these have actually run
  sections.push(
    await runQuery(
      "procedure_stats_invoice_report",
      `
      SELECT TOP 50
          OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
          ps.execution_count,
          ps.last_execution_time,
          ps.last_elapsed_time / 1000 AS last_elapsed_ms
      FROM sys.dm_exec_procedure_stats ps
      WHERE OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'RPT_%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP_RPT_%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP_AR%Print%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP_%PrintInvoice%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP_%InvoicePrint%'
      ORDER BY ps.last_execution_time DESC;
      `,
      30_000,
    ),
  );

  // 3. Look for any cached statement that mentions the report system parameter
  //    or the Crystal Reports DLL — by the proc text, not text-LIKE on full cache.
  //    Specifically check WA_AR.dll's PrintInvoice handler — UI strings indicate
  //    it exists but binary symbol is mangled. Look at procedure_stats for any
  //    proc whose name resembles "rpt" + "ar" + "invoice".
  sections.push(
    await runQuery(
      "system_params_for_reports",
      `
      SELECT TOP 50 *
      FROM SystemParameters
      WHERE ParamName LIKE '%report%'
         OR ParamName LIKE '%rpt%'
         OR ParamName LIKE '%print%'
         OR ParamName LIKE '%path%'
      ORDER BY ParamName;
      `,
      30_000,
    ),
  );

  // 4. Look in NBC_* and CRUFL_* tables (if they exist) — Crystal Reports
  //    might store report metadata in tables.
  sections.push(
    await runQuery(
      "report_storage_tables",
      `
      SELECT name, type_desc, create_date
      FROM sys.objects
      WHERE type IN ('U', 'V')
        AND (
          name LIKE 'NBC_%'
          OR name LIKE 'CR_Report%'
          OR name LIKE '%Report_%'
          OR name LIKE 'Report_%'
          OR name LIKE '%Rpt%'
        )
      ORDER BY name;
      `,
      30_000,
    ),
  );

  // Print
  console.log("\n=== Probe summary ===\n");
  for (const s of sections) {
    const tag = s.errored ? "ERRORED" : `rows=${s.rowCount}`;
    console.log(`[${s.name}]  ${tag}  (${s.elapsedMs}ms)`);
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
        .map(([k, v]) => `${k}=${trunc(v, 120)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 30) console.log(`   … (${s.rowCount - 30} more rows)`);
    console.log();
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-invoice-report-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
