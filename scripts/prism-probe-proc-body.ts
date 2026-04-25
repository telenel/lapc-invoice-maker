/**
 * READ-ONLY. Recover the body of one or more stored procedures by reading
 * sys.dm_exec_query_stats for cached individual statements whose
 * containing_object matches the proc name. Works even when pdt lacks
 * VIEW DEFINITION (which would NULL out OBJECT_DEFINITION / sys.sql_modules)
 * because the plan cache stores the executed statements directly.
 *
 * Strictly SELECT-only against sys.* DMVs and catalog views. Touches no user
 * tables, fires no procs, issues no DDL.
 *
 * Usage:
 *   npx tsx scripts/prism-probe-proc-body.ts <proc1> <proc2> ...
 *   PRISM_PROBE_PROCS=SP_X,SP_Y npx tsx scripts/prism-probe-proc-body.ts
 *
 * Output:
 *   - Console summary
 *   - Full results saved to tmp/prism-proc-body-<timestamp>.json
 *   - Per-proc stitched bodies saved to tmp/prism-proc-body-<proc>-<timestamp>.sql
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
  params: { name: string; value: string | number }[] = [],
  timeoutMs = 60_000,
): Promise<Section> {
  const pool = await getPrismPool();
  const req = pool.request();
  (req as unknown as { timeout: number }).timeout = timeoutMs;
  for (const p of params) {
    req.input(p.name, p.value);
  }
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

function getProcNames(): string[] {
  const fromArgs = process.argv.slice(2).filter(Boolean);
  if (fromArgs.length > 0) return fromArgs;
  const fromEnv = (process.env.PRISM_PROBE_PROCS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv;
}

async function main() {
  const procs = getProcNames();
  if (procs.length === 0) {
    console.error(
      "No procs specified. Pass them as args or set PRISM_PROBE_PROCS=name1,name2.",
    );
    process.exit(1);
  }

  console.log(`Probing plan cache for: ${procs.join(", ")}\n`);
  const sections: Section[] = [];

  // 1. Catalog metadata for each requested proc — confirms it exists, gives create/modify dates
  const procListSql = procs.map((_, i) => `@p${i}`).join(",");
  sections.push(
    await runQuery(
      "catalog_metadata",
      `
      SELECT name, type_desc, create_date, modify_date, is_ms_shipped
      FROM sys.objects
      WHERE name IN (${procListSql})
      ORDER BY name;
      `,
      procs.map((p, i) => ({ name: `p${i}`, value: p })),
      30_000,
    ),
  );

  // 2. Procedure-stats — execution count + last run time
  sections.push(
    await runQuery(
      "procedure_stats",
      `
      SELECT
          OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
          ps.execution_count,
          ps.last_execution_time,
          ps.last_elapsed_time / 1000 AS last_elapsed_ms,
          ps.cached_time
      FROM sys.dm_exec_procedure_stats ps
      WHERE OBJECT_NAME(ps.object_id, ps.database_id) IN (${procListSql})
      ORDER BY ps.last_execution_time DESC;
      `,
      procs.map((p, i) => ({ name: `p${i}`, value: p })),
      30_000,
    ),
  );

  // 3. OBJECT_DEFINITION attempt (returns NULL if no VIEW DEFINITION)
  sections.push(
    await runQuery(
      "object_definition_attempt",
      `
      SELECT
          name,
          DATALENGTH(OBJECT_DEFINITION(object_id)) AS def_byte_length,
          OBJECT_DEFINITION(object_id) AS definition
      FROM sys.objects
      WHERE name IN (${procListSql})
      AND type_desc LIKE '%PROCEDURE%';
      `,
      procs.map((p, i) => ({ name: `p${i}`, value: p })),
      30_000,
    ),
  );

  // 4. The main course — cached individual statements with containing_object matching each proc.
  // We loop per proc to keep each query plan-cache scan narrow.
  const stitchedBodies: Record<string, string[]> = {};
  for (const proc of procs) {
    const sec = await runQuery(
      `plan_cache_${proc}`,
      `
      SELECT
          qs.execution_count,
          qs.last_execution_time,
          qs.creation_time,
          qs.statement_start_offset,
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
      WHERE OBJECT_NAME(st.objectid, st.dbid) = @procName
      ORDER BY qs.statement_start_offset;
      `,
      [{ name: "procName", value: proc }],
      180_000,
    );
    sections.push(sec);

    if (sec.rowCount > 0) {
      const stitched: string[] = [];
      const seen = new Set<string>();
      for (const r of sec.rows as Record<string, unknown>[]) {
        const text = String(r.statement_text ?? "").trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          stitched.push(text);
        }
      }
      stitchedBodies[proc] = stitched;
    }
  }

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
    const sample = s.rows.slice(0, 3);
    for (const r of sample as Record<string, unknown>[]) {
      const cols = Object.entries(r)
        .map(([k, v]) => `${k}=${truncate(v, 100)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 3) console.log(`   … (${s.rowCount - 3} more rows)`);
    console.log();
  }

  // Save outputs
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  const outJson = path.join(tmpDir, `prism-proc-body-${ts}.json`);
  fs.writeFileSync(outJson, JSON.stringify(sections, null, 2));
  console.log(`Full results JSON: ${outJson}`);

  for (const [proc, statements] of Object.entries(stitchedBodies)) {
    const outSql = path.join(tmpDir, `prism-proc-body-${proc}-${ts}.sql`);
    const header = `-- Recovered from plan cache: ${proc}\n-- ${statements.length} unique statements, ordered by statement_start_offset\n-- Note: gaps possible if any statements were evicted from the cache.\n\n`;
    fs.writeFileSync(outSql, header + statements.join("\n\n;-- ---\n\n") + "\n");
    console.log(`  Stitched body for ${proc}: ${outSql}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
