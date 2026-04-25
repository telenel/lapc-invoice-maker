/**
 * READ-ONLY. Probe SQL Server's plan cache and procedure-stats DMVs for any
 * recently-executed statement that touches the AR invoice tables, plus any
 * SP_AR* / P_Item_Add_GM execution. Also tries OBJECT_DEFINITION / sys.sql_modules
 * to see if pdt has VIEW DEFINITION on the relevant procs.
 *
 * Strictly SELECT-only. Touches:
 *   - sys.dm_exec_query_stats  (cached plan stats)
 *   - sys.dm_exec_sql_text     (cached SQL text)
 *   - sys.dm_exec_procedure_stats
 *   - sys.objects / sys.sql_modules
 *   - OBJECT_DEFINITION (returns NULL if no permission)
 *
 * Does NOT INSERT/UPDATE/DELETE/MERGE/EXEC any user-data proc. Does NOT issue
 * DDL. Does NOT touch any Acct_*, Item, Inventory, Transaction_*, etc. table.
 *
 * Output:
 *   - Console summary (truncated)
 *   - Full results saved to tmp/prism-arinvoice-cache-<timestamp>.json
 *
 * Usage: npx tsx scripts/probe-prism-arinvoice-cache.ts
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

async function runQuery(label: string, query: string, timeoutMs = 60_000): Promise<Section> {
  const pool = await getPrismPool();
  const req = pool.request();
  (req as unknown as { timeout: number }).timeout = timeoutMs;
  const t0 = Date.now();
  try {
    const result = await req.query(query);
    return {
      name: label,
      rowCount: result.recordset.length,
      rows: result.recordset,
      elapsedMs: Date.now() - t0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: label,
      rowCount: 0,
      rows: [],
      errored: message,
      elapsedMs: Date.now() - t0,
    };
  }
}

function truncate(s: unknown, max = 200): string {
  if (s === null || s === undefined) return "<null>";
  const str = String(s).replace(/\s+/g, " ").trim();
  return str.length <= max ? str : str.slice(0, max) + "…";
}

async function main() {
  const sections: Section[] = [];

  // 1. Catalog metadata — cheap. Confirms which procs exist by name.
  sections.push(
    await runQuery(
      "catalog_matching_procs",
      `
      SELECT TOP 200
          name,
          type_desc,
          create_date,
          modify_date,
          is_ms_shipped
      FROM sys.objects
      WHERE type_desc = 'SQL_STORED_PROCEDURE'
          AND (
              name LIKE 'SP_AR%'
              OR name LIKE '%ARInvoice%'
              OR name LIKE '%Autogen%'
              OR name LIKE 'P_Item_%'
          )
      ORDER BY name;
      `,
      30_000,
    ),
  );

  // 2. Procedure-stats — cheap. Indexed by object_id; no string scanning.
  sections.push(
    await runQuery(
      "procedure_stats_ar_and_item",
      `
      SELECT TOP 100
          OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
          DB_NAME(ps.database_id) AS db_name,
          ps.execution_count,
          ps.last_execution_time,
          ps.last_elapsed_time / 1000 AS last_elapsed_ms,
          ps.cached_time
      FROM sys.dm_exec_procedure_stats ps
      WHERE OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP_AR%'
          OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'P_Item_%'
          OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE '%Autogen%'
          OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE '%ARInvoice%'
      ORDER BY ps.last_execution_time DESC;
      `,
      30_000,
    ),
  );

  // 3. OBJECT_DEFINITION — cheap. Returns NULL silently if no VIEW DEFINITION.
  sections.push(
    await runQuery(
      "object_definition_attempt",
      `
      SELECT
          name,
          type_desc,
          create_date,
          modify_date,
          DATALENGTH(OBJECT_DEFINITION(object_id)) AS def_byte_length,
          OBJECT_DEFINITION(object_id) AS definition
      FROM sys.objects
      WHERE name IN (
          'SP_ARAutogenInvoices',
          'SP_ARDeleteAutoInvoice',
          'SP_ARCreateMOTran',
          'P_Item_Add_GM'
      )
      AND type_desc LIKE '%PROCEDURE%';
      `,
      30_000,
    ),
  );

  // 4. sys.sql_modules — alternate route to proc body. Same VIEW DEFINITION dependency.
  sections.push(
    await runQuery(
      "sql_modules_attempt",
      `
      SELECT
          o.name,
          o.type_desc,
          DATALENGTH(m.definition) AS def_byte_length,
          m.definition
      FROM sys.sql_modules m
      INNER JOIN sys.objects o ON o.object_id = m.object_id
      WHERE o.name IN (
          'SP_ARAutogenInvoices',
          'SP_ARDeleteAutoInvoice',
          'SP_ARCreateMOTran',
          'P_Item_Add_GM'
      );
      `,
      30_000,
    ),
  );

  // 5. Plan-cache LIKE scan — EXPENSIVE. Generous timeout. Per-query try/catch isolates failure.
  sections.push(
    await runQuery(
      "plan_cache_arinvoice_text",
      `
      SELECT TOP 50
          qs.execution_count,
          qs.last_execution_time,
          qs.creation_time,
          SUBSTRING(
              st.text,
              (qs.statement_start_offset / 2) + 1,
              ((CASE qs.statement_end_offset
                  WHEN -1 THEN DATALENGTH(st.text)
                  ELSE qs.statement_end_offset
               END - qs.statement_start_offset) / 2) + 1
          ) AS statement_text,
          DB_NAME(st.dbid) AS db_name,
          OBJECT_NAME(st.objectid, st.dbid) AS containing_object
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
      WHERE
          st.text LIKE '%Acct_ARInvoice_Header%'
          OR st.text LIKE '%Acct_ARInvoice_Detail%'
          OR st.text LIKE '%Acct_ARInvoice_Pymt%'
      ORDER BY qs.last_execution_time DESC;
      `,
      180_000,
    ),
  );

  // 6. Plan-cache: proc invocations
  sections.push(
    await runQuery(
      "plan_cache_proc_text",
      `
      SELECT TOP 50
          qs.execution_count,
          qs.last_execution_time,
          SUBSTRING(
              st.text,
              (qs.statement_start_offset / 2) + 1,
              ((CASE qs.statement_end_offset
                  WHEN -1 THEN DATALENGTH(st.text)
                  ELSE qs.statement_end_offset
               END - qs.statement_start_offset) / 2) + 1
          ) AS statement_text,
          OBJECT_NAME(st.objectid, st.dbid) AS containing_object
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
      WHERE
          st.text LIKE '%SP_ARAutogenInvoices%'
          OR st.text LIKE '%P_Item_Add_GM%'
      ORDER BY qs.last_execution_time DESC;
      `,
      180_000,
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
    // Print first 5 rows truncated
    const sample = s.rows.slice(0, 5);
    for (const r of sample as Record<string, unknown>[]) {
      const cols = Object.entries(r)
        .map(([k, v]) => `${k}=${truncate(v, 120)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 5) console.log(`   … (${s.rowCount - 5} more rows in JSON output)`);
    console.log();
  }

  // Save full JSON
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-arinvoice-cache-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`\nFull results saved to: ${outFile}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
