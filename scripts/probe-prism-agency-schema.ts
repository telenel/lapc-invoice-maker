/**
 * READ-ONLY. Recover the AR-agency schema (Acct_Agency + related tables) and
 * try harder to find any cached INSERT INTO Acct_Agency statement.
 *
 * Approach:
 *  1. Schema dump for Acct_Agency family (columns, types, nullable, defaults).
 *  2. Foreign-key map for Acct_Agency.
 *  3. Plan cache LIKE scan with 4-minute timeout — last attempt to surface
 *     any cached creation INSERT, including from old sessions.
 *  4. Sample existing rows (TOP 3, no PII columns) to confirm column semantics.
 *
 * Strictly SELECT-only. No writes, no DDL, no proc execution.
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

async function main() {
  const sections: Section[] = [];

  // 1. Acct_Agency column schema + defaults
  sections.push(
    await runQuery(
      "acct_agency_columns",
      `
      SELECT
          c.column_id,
          c.name AS column_name,
          t.name AS data_type,
          c.max_length,
          c.precision,
          c.scale,
          c.is_nullable,
          c.is_identity,
          dc.definition AS default_definition
      FROM sys.columns c
      INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
      LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
      WHERE c.object_id = OBJECT_ID('dbo.Acct_Agency')
      ORDER BY c.column_id;
      `,
      30_000,
    ),
  );

  // 2. Related Acct_Agency_* tables — schema for each
  sections.push(
    await runQuery(
      "acct_agency_related_tables",
      `
      SELECT
          o.name AS table_name,
          c.column_id,
          c.name AS column_name,
          t.name AS data_type,
          c.max_length,
          c.is_nullable,
          c.is_identity,
          dc.definition AS default_definition
      FROM sys.objects o
      INNER JOIN sys.columns c ON c.object_id = o.object_id
      INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
      LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
      WHERE o.type = 'U'
        AND o.name LIKE 'Acct_Agency%'
        AND o.name <> 'Acct_Agency'
      ORDER BY o.name, c.column_id;
      `,
      30_000,
    ),
  );

  // 3. FK map outbound from Acct_Agency
  sections.push(
    await runQuery(
      "acct_agency_fk_outbound",
      `
      SELECT
          fk.name AS fk_name,
          OBJECT_NAME(fkc.parent_object_id) AS table_name,
          c1.name AS column_name,
          OBJECT_NAME(fkc.referenced_object_id) AS ref_table,
          c2.name AS ref_column
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns c1 ON c1.object_id = fkc.parent_object_id AND c1.column_id = fkc.parent_column_id
      INNER JOIN sys.columns c2 ON c2.object_id = fkc.referenced_object_id AND c2.column_id = fkc.referenced_column_id
      WHERE fk.parent_object_id = OBJECT_ID('dbo.Acct_Agency')
      ORDER BY fk.name, fkc.constraint_column_id;
      `,
      30_000,
    ),
  );

  // 4. FK map inbound (who depends on Acct_Agency)
  sections.push(
    await runQuery(
      "acct_agency_fk_inbound",
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
      WHERE fk.referenced_object_id = OBJECT_ID('dbo.Acct_Agency')
      ORDER BY OBJECT_NAME(fkc.parent_object_id), fk.name;
      `,
      30_000,
    ),
  );

  // 5. Triggers on Acct_Agency
  sections.push(
    await runQuery(
      "acct_agency_triggers",
      `
      SELECT
          name AS trigger_name,
          parent_id,
          OBJECT_NAME(parent_id) AS parent_table,
          is_disabled,
          create_date,
          modify_date
      FROM sys.triggers
      WHERE parent_id = OBJECT_ID('dbo.Acct_Agency');
      `,
      30_000,
    ),
  );

  // 6. Sample 3 existing agency rows for column-semantics confirmation.
  //    Pierce-only. AgencyTypeID-aware to keep PII out — pull the structural fields.
  sections.push(
    await runQuery(
      "acct_agency_sample",
      `
      SELECT TOP 5
          AgencyID,
          AgencyNumber,
          Description,
          AgencyTypeID,
          fInvoiceInAR,
          fBilling,
          fTaxExempt,
          fAutoCreateInvoice,
          fDebit,
          ProcessUser,
          ModifiedDate
      FROM Acct_Agency
      WHERE AgencyNumber LIKE 'PSP%'
      ORDER BY AgencyID DESC;
      `,
      30_000,
    ),
  );

  // 7. Plan-cache LIKE scan, generous timeout, narrow filter
  sections.push(
    await runQuery(
      "plan_cache_acct_agency_insert",
      `
      SELECT TOP 50
          OBJECT_NAME(st.objectid, st.dbid) AS containing_object,
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
          ) AS statement_text
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
      WHERE st.text LIKE '%INSERT INTO Acct_Agency %'
         OR st.text LIKE '%INSERT INTO [Acct_Agency]%'
         OR st.text LIKE '%insert into Acct_Agency %'
         OR st.text LIKE '%insert into [Acct_Agency]%'
      ORDER BY qs.last_execution_time DESC;
      `,
      240_000,
    ),
  );

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
    const sample = s.rows.slice(0, 12);
    for (const r of sample as Record<string, unknown>[]) {
      const cols = Object.entries(r)
        .map(([k, v]) => `${k}=${trunc(v, 120)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 12) console.log(`   … (${s.rowCount - 12} more rows in JSON output)`);
    console.log();
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-agency-schema-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
