/**
 * READ-ONLY. Discover triggers on Acct_ARInvoice_Header (and the sibling
 * AR-invoice tables) and recover their bodies from the plan cache.
 *
 * Goal: confirm any side-effects that fire on Acct_ARInvoice_Header insert
 * before laportal mirrors the receipt-to-invoice contract from
 * docs/prism/static/actions/generate-invoices.md.
 *
 * Strategy:
 *  1. List every trigger whose parent is one of the Acct_ARInvoice_* tables.
 *  2. For each trigger, pull cached statements via OBJECT_NAME(st.objectid)
 *     match — the same plan-cache method that worked for procs in
 *     docs/prism/static/plan-cache-method.md.
 *
 * Strictly SELECT-only against sys.* DMVs and catalog views. Touches no
 * user tables, fires no procs, issues no DDL.
 *
 * Usage:
 *   npx tsx scripts/probe-prism-arinvoice-triggers.ts
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

const AR_INVOICE_TABLES = [
  "Acct_ARInvoice_Header",
  "Acct_ARInvoice_Detail",
  "Acct_ARInvoice_Tender",
  "Acct_ARInvoice_Pymt",
  "Acct_ARInvoice_GiftCert",
  "Acct_ARInvoice_BadChk",
];

async function main() {
  const sections: Section[] = [];

  // 1. Trigger inventory across all AR-invoice tables
  sections.push(
    await runQuery(
      "trigger_inventory",
      `
      SELECT
          t.name AS trigger_name,
          OBJECT_NAME(t.parent_id) AS parent_table,
          t.is_disabled,
          t.is_instead_of_trigger,
          t.create_date,
          t.modify_date
      FROM sys.triggers t
      WHERE OBJECT_NAME(t.parent_id) IN (
          ${AR_INVOICE_TABLES.map((n) => `'${n}'`).join(", ")}
      )
      ORDER BY parent_table, trigger_name;
      `,
      30_000,
    ),
  );

  // Discover the trigger names that came back; probe each one's body.
  const triggers = sections[0].rows as Array<{ trigger_name: string; parent_table: string }>;
  const triggerNames = triggers.map((t) => t.trigger_name);

  console.log(`\nDiscovered ${triggerNames.length} triggers:`);
  for (const t of triggers) {
    console.log(`  ${t.trigger_name.padEnd(40)} (parent: ${t.parent_table})`);
  }
  console.log();

  // 2. Procedure-stats for the triggers (treats them as procs)
  if (triggerNames.length > 0) {
    sections.push(
      await runQuery(
        "trigger_exec_stats",
        `
        SELECT
            OBJECT_NAME(ps.object_id, ps.database_id) AS trigger_name,
            ps.execution_count,
            ps.last_execution_time,
            ps.last_elapsed_time / 1000 AS last_elapsed_ms
        FROM sys.dm_exec_procedure_stats ps
        WHERE OBJECT_NAME(ps.object_id, ps.database_id) IN (
            ${triggerNames.map((n) => `'${n}'`).join(", ")}
        )
        ORDER BY ps.last_execution_time DESC;
        `,
        30_000,
      ),
    );

    // 3. Plan-cache statements per trigger
    const stitchedBodies: Record<string, string[]> = {};
    for (const trigger of triggerNames) {
      const sec = await runQuery(
        `plan_cache_${trigger}`,
        `
        SELECT
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
            ) AS statement_text,
            OBJECT_NAME(st.objectid, st.dbid) AS containing_object
        FROM sys.dm_exec_query_stats qs
        CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
        WHERE OBJECT_NAME(st.objectid, st.dbid) = '${trigger}'
        ORDER BY qs.statement_start_offset;
        `,
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
        stitchedBodies[trigger] = stitched;
      }
    }

    // Print summary
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
      const sample = s.rows.slice(0, 3);
      for (const r of sample as Record<string, unknown>[]) {
        const cols = Object.entries(r)
          .map(([k, v]) => `${k}=${trunc(v, 120)}`)
          .join("  ");
        console.log(`   ${cols}`);
      }
      if (s.rowCount > 3) console.log(`   … (${s.rowCount - 3} more rows)`);
      console.log();
    }

    // Write outputs
    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    const outJson = path.join(tmpDir, `prism-arinvoice-triggers-${ts}.json`);
    fs.writeFileSync(outJson, JSON.stringify(sections, null, 2));
    console.log(`Full results JSON: ${outJson}`);

    for (const [trigger, statements] of Object.entries(stitchedBodies)) {
      const outSql = path.join(tmpDir, `prism-trigger-body-${trigger}-${ts}.sql`);
      const header = `-- Recovered from plan cache: ${trigger}\n-- ${statements.length} unique statements, ordered by statement_start_offset\n-- Note: gaps possible if any statements were evicted from the cache.\n\n`;
      fs.writeFileSync(outSql, header + statements.join("\n\n;-- ---\n\n") + "\n");
      console.log(`  Stitched body: ${outSql}`);
    }
  } else {
    console.log("No triggers found on AR-invoice tables. Nothing to probe.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
