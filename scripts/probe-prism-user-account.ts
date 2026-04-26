/**
 * READ-ONLY. Reverse-engineer Marcos's PrismUser account by username.
 *
 * Strictly SELECT-only against prism_security.dbo.PrismUser, related
 * security/audit tables, and AR/POS tables filtered by his SUID. No
 * INSERT/UPDATE/DELETE/MERGE/EXEC-of-writing-procs/DDL.
 *
 * Usage:
 *   npx tsx scripts/probe-prism-user-account.ts [username]
 *
 * Default username is "2020".
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
  const username = process.argv[2] ?? "2020";
  console.log(`Probing PrismUser account: UserName='${username}'\n`);

  const sections: Section[] = [];

  // 1. PrismUser table schema
  sections.push(
    await runQuery(
      "prismuser_columns",
      `
      SELECT
          c.name AS column_name,
          t.name AS data_type,
          c.max_length,
          c.is_nullable,
          c.is_identity
      FROM prism_security.sys.columns c
      INNER JOIN prism_security.sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('prism_security.dbo.PrismUser')
      ORDER BY c.column_id;
      `,
      [],
      30_000,
    ),
  );

  // 2. The actual user row
  sections.push(
    await runQuery(
      "marcos_row",
      `
      SELECT *
      FROM prism_security.dbo.PrismUser
      WHERE UserName = @username;
      `,
      [{ name: "username", value: username }],
      30_000,
    ),
  );

  // 3. List user-related tables in prism_security
  sections.push(
    await runQuery(
      "prism_security_user_tables",
      `
      SELECT
          name AS table_name,
          type_desc,
          create_date
      FROM prism_security.sys.objects
      WHERE type IN ('U', 'V')
        AND (
          name LIKE '%User%'
          OR name LIKE '%Role%'
          OR name LIKE '%Permission%'
          OR name LIKE '%Login%'
          OR name LIKE '%Cashier%'
        )
      ORDER BY name;
      `,
      [],
      30_000,
    ),
  );

  // 4. Foreign keys outbound from PrismUser
  sections.push(
    await runQuery(
      "prismuser_fk_outbound",
      `
      SELECT
          fk.name AS fk_name,
          c1.name AS column_name,
          OBJECT_NAME(fkc.referenced_object_id) AS ref_table,
          c2.name AS ref_column
      FROM prism_security.sys.foreign_keys fk
      INNER JOIN prism_security.sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN prism_security.sys.columns c1 ON c1.object_id = fkc.parent_object_id AND c1.column_id = fkc.parent_column_id
      INNER JOIN prism_security.sys.columns c2 ON c2.object_id = fkc.referenced_object_id AND c2.column_id = fkc.referenced_column_id
      WHERE fk.parent_object_id = OBJECT_ID('prism_security.dbo.PrismUser')
      ORDER BY fk.name;
      `,
      [],
      30_000,
    ),
  );

  // 5. FK inbound — what depends on PrismUser
  sections.push(
    await runQuery(
      "prismuser_fk_inbound",
      `
      SELECT
          fk.name AS fk_name,
          OBJECT_NAME(fkc.parent_object_id) AS dependent_table,
          c1.name AS dependent_column,
          c2.name AS referenced_column
      FROM prism_security.sys.foreign_keys fk
      INNER JOIN prism_security.sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN prism_security.sys.columns c1 ON c1.object_id = fkc.parent_object_id AND c1.column_id = fkc.parent_column_id
      INNER JOIN prism_security.sys.columns c2 ON c2.object_id = fkc.referenced_object_id AND c2.column_id = fkc.referenced_column_id
      WHERE fk.referenced_object_id = OBJECT_ID('prism_security.dbo.PrismUser')
      ORDER BY OBJECT_NAME(fkc.parent_object_id);
      `,
      [],
      30_000,
    ),
  );

  // 6. AR-invoice activity attributed to this user
  sections.push(
    await runQuery(
      "ar_invoice_count",
      `
      DECLARE @suid int = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username);

      SELECT
          @suid AS suid,
          COUNT(*) AS invoice_count,
          MIN(InvoiceDate) AS first_invoice,
          MAX(InvoiceDate) AS last_invoice,
          SUM(InvoiceAmt) AS total_invoice_amt
      FROM Acct_ARInvoice_Header
      WHERE UserID = @suid;
      `,
      [{ name: "username", value: username }],
      30_000,
    ),
  );

  // 7. 5 most-recent AR invoices created by this user
  sections.push(
    await runQuery(
      "ar_invoice_recent",
      `
      DECLARE @suid int = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username);

      SELECT TOP 5
          h.ARInvoiceID,
          RTRIM(h.InvoiceNumber) AS InvoiceNumber,
          h.InvoiceDate,
          h.AgencyID,
          RTRIM(a.AgencyNumber) AS AgencyNumber,
          h.InvoiceAmt,
          h.LocationID,
          l.Description AS LocationDesc
      FROM Acct_ARInvoice_Header h
      LEFT JOIN Acct_Agency a ON a.AgencyID = h.AgencyID
      LEFT JOIN Location l ON l.LocationID = h.LocationID
      WHERE h.UserID = @suid
      ORDER BY h.ARInvoiceID DESC;
      `,
      [{ name: "username", value: username }],
      30_000,
    ),
  );

  // 8. Look for any `UserID`/`UserId` columns across the prism database that
  //    reference this user. Counts only — light scan.
  sections.push(
    await runQuery(
      "tables_with_userid_col",
      `
      SELECT
          OBJECT_NAME(c.object_id) AS table_name,
          c.name AS column_name,
          t.name AS data_type
      FROM sys.columns c
      INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
      INNER JOIN sys.objects o ON o.object_id = c.object_id
      WHERE o.type = 'U'
        AND c.name IN ('UserID', 'UserId', 'USERID', 'PrismUserID', 'PrismUserId', 'CashierID', 'ProcessUser', 'ModifiedBy', 'CreatedBy', 'fStaffID')
      ORDER BY OBJECT_NAME(c.object_id), c.name;
      `,
      [],
      60_000,
    ),
  );

  // 9. Cashier login history if Cashier table exists
  sections.push(
    await runQuery(
      "cashier_lookup",
      `
      IF OBJECT_ID('Cashier') IS NOT NULL
      BEGIN
          SELECT TOP 5 *
          FROM Cashier
          WHERE CashierID = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username)
             OR ISNULL(StaffID, 0) = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username)
             OR Description LIKE '%MARCOS%'
             OR Description LIKE '%Marcos%'
      END
      ELSE
          SELECT 'Cashier table not found' AS note;
      `,
      [{ name: "username", value: username }],
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
        .map(([k, v]) => `${k}=${trunc(v, 150)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 30) console.log(`   … (${s.rowCount - 30} more rows in JSON output)`);
    console.log();
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-user-account-${username}-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
