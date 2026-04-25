/**
 * READ-ONLY. Capture cached INSERT/UPDATE statements that touched any
 * Acct_Agency* table within a recent time window. Designed for the
 * "Marcos creates one test agency in WPAdmin → re-probe immediately" flow.
 *
 * The previous full LIKE scan on sys.dm_exec_sql_text timed out at 30s
 * because it had to materialize text for every cached plan. This script
 * narrows the scan to plans executed in the last N minutes (default 30),
 * which dramatically reduces the working set.
 *
 * Strictly SELECT-only against sys.* DMVs and catalog views.
 *
 * Usage:
 *   npx tsx scripts/probe-prism-recent-agency-writes.ts [minutes]
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

type Section = { name: string; rowCount: number; rows: unknown[]; errored?: string; elapsedMs?: number };

async function runQuery(label: string, query: string, timeoutMs = 240_000): Promise<Section> {
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
  const minutes = Number(process.argv[2] ?? 30);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.error("Pass a positive integer minute window. e.g. 30");
    process.exit(1);
  }
  console.log(`Scanning plan cache for Acct_Agency* writes in the last ${minutes} minutes...\n`);

  const sections: Section[] = [];

  // 1. Recent statements that touch Acct_Agency or its sibling tables.
  //    Filter applies to the EXTRACTED statement text via a CTE so we only
  //    match the specific cached statement, not just any sibling statement
  //    in the same batch (which produces noise from triggers that mention
  //    Acct_Agency in unrelated subqueries).
  sections.push(
    await runQuery(
      "recent_agency_writes",
      `
      WITH recent_stmts AS (
          SELECT
              OBJECT_NAME(st.objectid, st.dbid) AS containing_object,
              qs.execution_count,
              qs.last_execution_time,
              qs.creation_time,
              qs.statement_start_offset,
              qs.statement_end_offset,
              SUBSTRING(
                  st.text,
                  (qs.statement_start_offset / 2) + 1,
                  ((CASE qs.statement_end_offset
                      WHEN -1 THEN DATALENGTH(st.text)
                      ELSE qs.statement_end_offset
                   END - qs.statement_start_offset) / 2) + 1
              ) AS statement_text
          FROM sys.dm_exec_query_stats qs
          CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
          WHERE qs.last_execution_time >= DATEADD(minute, -${minutes}, GETDATE())
            AND qs.statement_end_offset != -1
      )
      SELECT *
      FROM recent_stmts
      WHERE
          containing_object IS NULL
          AND LEN(statement_text) BETWEEN 20 AND 5000
          AND statement_text NOT LIKE '%dm_exec_query_stats%'
          AND statement_text NOT LIKE '%dm_exec_sql_text%'
          AND (
              statement_text LIKE 'INSERT INTO Acct[_]Agency %'
              OR statement_text LIKE 'INSERT INTO Acct[_]Agency(%'
              OR statement_text LIKE 'insert into Acct[_]Agency %'
              OR statement_text LIKE 'insert into Acct[_]Agency(%'
              OR statement_text LIKE '(@%) INSERT INTO Acct[_]Agency %'
              OR statement_text LIKE '(@%) INSERT INTO Acct[_]Agency(%'
              OR statement_text LIKE '(@%) insert into Acct[_]Agency %'
              OR statement_text LIKE 'UPDATE Acct[_]Agency %'
              OR statement_text LIKE 'update Acct[_]Agency %'
              OR statement_text LIKE '(@%) UPDATE Acct[_]Agency %'
              OR statement_text LIKE '(@%) update Acct[_]Agency %'
          )
      ORDER BY last_execution_time DESC, statement_start_offset;
      `,
      240_000,
    ),
  );

  // 2. Recent statements touching the secondary Acct_Agency_* tables —
  //    typically populated by the same form (Customer linkage, DCC perms,
  //    NonMerch fees). Same CTE pattern.
  sections.push(
    await runQuery(
      "recent_agency_secondary_writes",
      `
      WITH recent_stmts AS (
          SELECT
              OBJECT_NAME(st.objectid, st.dbid) AS containing_object,
              qs.execution_count,
              qs.last_execution_time,
              qs.statement_start_offset,
              qs.statement_end_offset,
              SUBSTRING(
                  st.text,
                  (qs.statement_start_offset / 2) + 1,
                  ((CASE qs.statement_end_offset
                      WHEN -1 THEN DATALENGTH(st.text)
                      ELSE qs.statement_end_offset
                   END - qs.statement_start_offset) / 2) + 1
              ) AS statement_text
          FROM sys.dm_exec_query_stats qs
          CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
          WHERE qs.last_execution_time >= DATEADD(minute, -${minutes}, GETDATE())
            AND qs.statement_end_offset != -1
      )
      SELECT *
      FROM recent_stmts
      WHERE
          containing_object IS NULL
          AND LEN(statement_text) BETWEEN 20 AND 5000
          AND statement_text NOT LIKE '%dm_exec_query_stats%'
          AND statement_text NOT LIKE '%dm_exec_sql_text%'
          AND (
              statement_text LIKE 'INSERT INTO Acct[_]Agency[_]%'
              OR statement_text LIKE 'insert into Acct[_]Agency[_]%'
              OR statement_text LIKE '(@%) INSERT INTO Acct[_]Agency[_]%'
              OR statement_text LIKE '(@%) insert into Acct[_]Agency[_]%'
              OR statement_text LIKE 'UPDATE Acct[_]Agency[_]%'
              OR statement_text LIKE 'update Acct[_]Agency[_]%'
              OR statement_text LIKE '(@%) UPDATE Acct[_]Agency[_]%'
              OR statement_text LIKE '(@%) update Acct[_]Agency[_]%'
          )
      ORDER BY last_execution_time DESC, statement_start_offset;
      `,
      240_000,
    ),
  );

  // 3. Most-recent agency rows so we can confirm a test create landed.
  sections.push(
    await runQuery(
      "newest_agencies",
      `
      SELECT TOP 5
          AgencyID,
          RTRIM(AgencyNumber) AS AgencyNumber,
          Name,
          AgencyTypeID,
          fInvoiceInAR,
          fBilling
      FROM Acct_Agency
      ORDER BY AgencyID DESC;
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
    const sample = s.rows.slice(0, 12);
    for (const r of sample as Record<string, unknown>[]) {
      const cols = Object.entries(r)
        .map(([k, v]) => `${k}=${trunc(v, 200)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 12) console.log(`   … (${s.rowCount - 12} more rows in JSON output)`);
    console.log();
  }

  // Persist full results
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-recent-agency-writes-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
