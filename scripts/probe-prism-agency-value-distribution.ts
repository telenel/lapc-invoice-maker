/**
 * READ-ONLY. Sample existing Acct_Agency rows to derive a Pierce-style
 * INSERT template empirically.
 *
 * Strategy:
 *   1. Sample N "Pierce-flavored" agencies (AgencyNumber starts with 'P').
 *   2. For every column on Acct_Agency, compute:
 *      - non-null fill %
 *      - distinct value count
 *      - top 3 most-common values (with counts)
 *   3. Dump 5 full sample rows as worked examples.
 *
 * The output gives us, for every column: "what does Pierce usually put
 * here?" — combined with the schema (NOT NULL constraints, FKs), that's
 * a working contract for laportal to mirror without seeing a literal
 * MFC-generated INSERT.
 *
 * Strictly SELECT-only against Acct_Agency and sys.* catalog views.
 *
 * Usage:
 *   npx tsx scripts/probe-prism-agency-value-distribution.ts [LIKE-prefix]
 * Default prefix: 'P%' (catches Pierce-style agency numbers like PSP*).
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

type Section = { name: string; rowCount: number; rows: unknown[]; errored?: string; elapsedMs?: number };

async function runQuery(label: string, query: string, params: { name: string; value: unknown }[] = [], timeoutMs = 60_000): Promise<Section> {
  const pool = await getPrismPool();
  const req = pool.request();
  (req as unknown as { timeout: number }).timeout = timeoutMs;
  for (const p of params) req.input(p.name, p.value);
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
  const prefix = process.argv[2] ?? "P%";
  console.log(`Sampling Acct_Agency rows where AgencyNumber LIKE '${prefix}'...\n`);

  // Step 1: get column list for Acct_Agency
  const colsSec = await runQuery(
    "agency_columns",
    `
    SELECT
        c.name AS column_name,
        t.name AS data_type,
        c.is_nullable,
        c.is_identity
    FROM sys.columns c
    INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Acct_Agency')
    ORDER BY c.column_id;
    `,
    [],
    30_000,
  );

  if (colsSec.errored || colsSec.rowCount === 0) {
    console.error("Failed to read Acct_Agency schema:", colsSec.errored);
    process.exit(1);
  }

  const columns = colsSec.rows as Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
    is_identity: boolean;
  }>;

  // Step 2: matching agency count
  const matchCount = await runQuery(
    "matching_count",
    `SELECT COUNT(*) AS cnt FROM Acct_Agency WHERE AgencyNumber LIKE @prefix`,
    [{ name: "prefix", value: prefix }],
    30_000,
  );
  const totalMatching = (matchCount.rows[0] as { cnt: number } | undefined)?.cnt ?? 0;
  console.log(`Total matching agencies: ${totalMatching}\n`);
  if (totalMatching === 0) {
    console.error(`No agencies match prefix '${prefix}'. Try a different prefix.`);
    process.exit(0);
  }

  // Step 3: per-column fill stats
  type ColStat = {
    column: string;
    type: string;
    nullable: boolean;
    identity: boolean;
    populated: number;
    populatedPct: string;
    distinctCount: number;
    topValues: Array<{ value: unknown; count: number }>;
  };
  const stats: ColStat[] = [];

  for (const c of columns) {
    if (c.is_identity) {
      stats.push({
        column: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable,
        identity: true,
        populated: totalMatching,
        populatedPct: "100% (IDENTITY)",
        distinctCount: -1,
        topValues: [],
      });
      continue;
    }

    // Need to handle text vs numeric vs other for "populated" semantics
    const isStringy = ["char", "varchar", "nchar", "nvarchar", "text", "ntext"].includes(c.data_type);
    const popPredicate = isStringy
      ? `[${c.column_name}] IS NOT NULL AND LEN(LTRIM(RTRIM([${c.column_name}]))) > 0`
      : `[${c.column_name}] IS NOT NULL`;

    // Single query per column; cheap given the small filtered set
    const q = `
      SELECT
          (SELECT COUNT(*) FROM Acct_Agency WHERE AgencyNumber LIKE @prefix AND ${popPredicate}) AS populated,
          (SELECT COUNT(DISTINCT [${c.column_name}]) FROM Acct_Agency WHERE AgencyNumber LIKE @prefix AND ${popPredicate}) AS distinctCount;
    `;
    const r = await runQuery(
      `col_stats_${c.column_name}`,
      q,
      [{ name: "prefix", value: prefix }],
      30_000,
    );
    if (r.errored) {
      stats.push({
        column: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable,
        identity: false,
        populated: -1,
        populatedPct: `ERR ${r.errored.slice(0, 60)}`,
        distinctCount: -1,
        topValues: [],
      });
      continue;
    }

    const row = r.rows[0] as { populated: number; distinctCount: number };
    const populated = Number(row.populated ?? 0);
    const distinctCount = Number(row.distinctCount ?? 0);
    const populatedPct = totalMatching > 0 ? `${((populated / totalMatching) * 100).toFixed(1)}%` : "0%";

    // Top 3 most-common values (only if at least one populated and distinct count is small enough to be useful)
    let topValues: Array<{ value: unknown; count: number }> = [];
    if (populated > 0 && distinctCount > 0 && distinctCount <= 50) {
      const tq = `
        SELECT TOP 3 [${c.column_name}] AS val, COUNT(*) AS cnt
        FROM Acct_Agency
        WHERE AgencyNumber LIKE @prefix AND ${popPredicate}
        GROUP BY [${c.column_name}]
        ORDER BY COUNT(*) DESC;
      `;
      const tr = await runQuery(
        `col_top_${c.column_name}`,
        tq,
        [{ name: "prefix", value: prefix }],
        30_000,
      );
      if (!tr.errored) {
        topValues = (tr.rows as Array<{ val: unknown; cnt: number }>).map((r) => ({
          value: r.val,
          count: Number(r.cnt),
        }));
      }
    } else if (populated > 0 && distinctCount > 50) {
      // For high-cardinality columns, surface the most common value but note the spread
      const tq = `
        SELECT TOP 3 [${c.column_name}] AS val, COUNT(*) AS cnt
        FROM Acct_Agency
        WHERE AgencyNumber LIKE @prefix AND ${popPredicate}
        GROUP BY [${c.column_name}]
        ORDER BY COUNT(*) DESC;
      `;
      const tr = await runQuery(
        `col_top_${c.column_name}`,
        tq,
        [{ name: "prefix", value: prefix }],
        30_000,
      );
      if (!tr.errored) {
        topValues = (tr.rows as Array<{ val: unknown; cnt: number }>).map((r) => ({
          value: r.val,
          count: Number(r.cnt),
        }));
      }
    }

    stats.push({
      column: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable,
      identity: false,
      populated,
      populatedPct,
      distinctCount,
      topValues,
    });
  }

  // Step 4: 5 full sample rows
  const sample = await runQuery(
    "sample_rows",
    `
    SELECT TOP 5 *
    FROM Acct_Agency
    WHERE AgencyNumber LIKE @prefix
    ORDER BY AgencyID DESC;
    `,
    [{ name: "prefix", value: prefix }],
    30_000,
  );

  // Print summary
  console.log("=== Column fill rates ===");
  console.log(
    "Column".padEnd(28) +
      "Type".padEnd(14) +
      "Null?".padEnd(7) +
      "Pop %".padEnd(10) +
      "Distinct".padEnd(10) +
      "Top values"
  );
  console.log("─".repeat(120));
  for (const s of stats) {
    const top = s.topValues
      .slice(0, 3)
      .map((t) => `${trunc(t.value, 24)}=${t.count}`)
      .join("  ");
    console.log(
      s.column.padEnd(28) +
        s.type.padEnd(14) +
        (s.nullable ? "Y" : "N").padEnd(7) +
        s.populatedPct.padEnd(10) +
        String(s.distinctCount).padEnd(10) +
        top
    );
  }

  console.log("\n=== Top 5 most-recent matching rows ===");
  for (const r of sample.rows as Record<string, unknown>[]) {
    console.log("\n--- Agency", r.AgencyID, "---");
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === undefined || v === "") continue;
      console.log(`  ${k.padEnd(28)} ${trunc(v, 100)}`);
    }
  }

  // Persist full results
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-agency-value-distribution-${ts}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ prefix, totalMatching, stats, sampleRows: sample.rows }, null, 2),
  );
  console.log(`\nFull results: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
