/**
 * READ-ONLY. Hunt for the AR-agency (account) creation path.
 *
 * Strategy:
 *  1. Catalog: list every stored proc whose name mentions Agency / Acct.
 *  2. Procedure-stats: which of those have been executed recently.
 *  3. Plan cache by containing_object: pull statement bodies for any Agency-
 *     related proc that has been called.
 *  4. Plan cache by SQL text: find any cached statement that references
 *     `Acct_Agency` directly — picks up both proc-issued statements
 *     (containing_object set) and MFC-recordset-issued INSERTs (containing_object NULL).
 *
 * Strictly SELECT-only against sys.* DMVs and catalog views.
 *
 * Usage:
 *   npx tsx scripts/probe-prism-agency-create.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

type Section = {
  name: string;
  rowCount: number;
  rows: unknown[];
  errored?: string;
  elapsedMs?: number;
};

async function runQuery(
  label: string,
  query: string,
  timeoutMs = 60_000,
): Promise<Section> {
  const pool = await getPrismPool();
  const req = pool.request();
  (req as unknown as { timeout: number }).timeout = timeoutMs;
  const t0 = Date.now();
  try {
    const result = await req.query(query);
    return { name: label, rowCount: result.recordset.length, rows: result.recordset, elapsedMs: Date.now() - t0 };
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

function truncate(s: unknown, max = 200): string {
  if (s === null || s === undefined) return "<null>";
  return String(s).replace(/\s+/g, " ").trim().slice(0, max);
}

async function main() {
  const sections: Section[] = [];

  // 1. Catalog of agency-related procs
  sections.push(
    await runQuery(
      "catalog_agency_procs",
      `
      SELECT name, type_desc, create_date, modify_date
      FROM sys.objects
      WHERE type_desc = 'SQL_STORED_PROCEDURE'
        AND (
          name LIKE '%Agency%'
          OR name LIKE 'SP_AR%Acct%'
          OR name LIKE '%AcctAgency%'
        )
      ORDER BY name;
      `,
      30_000,
    ),
  );

  // 2. Procedure-stats for those procs
  sections.push(
    await runQuery(
      "procedure_stats_agency",
      `
      SELECT
          OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
          ps.execution_count,
          ps.last_execution_time,
          ps.last_elapsed_time / 1000 AS last_elapsed_ms
      FROM sys.dm_exec_procedure_stats ps
      WHERE OBJECT_NAME(ps.object_id, ps.database_id) LIKE '%Agency%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP_AR%Acct%'
      ORDER BY ps.last_execution_time DESC;
      `,
      30_000,
    ),
  );

  // 3. Plan cache: any cached statement whose containing_object is an
  //    Agency-related proc. Cheap because the predicate uses OBJECT_NAME on
  //    an indexed column.
  sections.push(
    await runQuery(
      "plan_cache_in_agency_procs",
      `
      SELECT
          OBJECT_NAME(st.objectid, st.dbid) AS containing_object,
          qs.execution_count,
          qs.last_execution_time,
          qs.statement_start_offset,
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
      WHERE OBJECT_NAME(st.objectid, st.dbid) LIKE '%Agency%'
         OR OBJECT_NAME(st.objectid, st.dbid) LIKE 'SP_AR%Acct%'
      ORDER BY OBJECT_NAME(st.objectid, st.dbid), qs.statement_start_offset;
      `,
      120_000,
    ),
  );

  // 4. Plan cache: any cached statement whose TEXT touches Acct_Agency,
  //    regardless of containing_object. Picks up MFC-issued INSERTs.
  //    Filter by recent last_execution_time to keep the LIKE scan tractable.
  sections.push(
    await runQuery(
      "plan_cache_acct_agency_text",
      `
      SELECT TOP 100
          OBJECT_NAME(st.objectid, st.dbid) AS containing_object,
          qs.execution_count,
          qs.last_execution_time,
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
      WHERE st.text LIKE '%INSERT%Acct_Agency%'
         OR st.text LIKE '%insert%acct_agency%'
         OR st.text LIKE '%UPDATE%Acct_Agency %'
         OR st.text LIKE '%UPDATE Acct_Agency%'
      ORDER BY qs.last_execution_time DESC;
      `,
      180_000,
    ),
  );

  // 5. OBJECT_DEFINITION attempt for any agency-add candidate procs
  sections.push(
    await runQuery(
      "object_definition_attempt",
      `
      SELECT
          name,
          DATALENGTH(OBJECT_DEFINITION(object_id)) AS def_byte_length,
          OBJECT_DEFINITION(object_id) AS definition
      FROM sys.objects
      WHERE type_desc = 'SQL_STORED_PROCEDURE'
        AND (name LIKE '%Agency%Add%' OR name LIKE '%AddAgency%' OR name LIKE '%Agency_Copy%' OR name LIKE '%Agency_Delete%');
      `,
      30_000,
    ),
  );

  // Print summary
  console.log("\n=== Probe summary ===\n");
  for (const s of sections) {
    const tag = s.errored ? "ERRORED" : `rows=${s.rowCount}`;
    console.log(`[${s.name}]  ${tag}  (${s.elapsedMs}ms)`);
    if (s.errored) {
      console.log(`   ! ${truncate(s.errored, 200)}`);
      continue;
    }
    if (s.rowCount === 0) {
      console.log("   (no rows)");
      continue;
    }
    const sample = s.rows.slice(0, 8);
    for (const r of sample as Record<string, unknown>[]) {
      const cols = Object.entries(r)
        .map(([k, v]) => `${k}=${truncate(v, 150)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 8) console.log(`   … (${s.rowCount - 8} more rows in JSON output)`);
    console.log();
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-agency-create-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
