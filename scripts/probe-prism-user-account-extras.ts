/**
 * READ-ONLY follow-up. Pull profile data from the related prism_security
 * tables that reference PrismUser.SUID.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

async function runQuery(label: string, query: string, params: { name: string; value: unknown }[] = []) {
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

function trunc(s: unknown, max = 150): string {
  if (s === null || s === undefined) return "<null>";
  return String(s).replace(/\s+/g, " ").trim().slice(0, max);
}

async function main() {
  const username = process.argv[2] ?? "2020";
  const sections = [];

  // What columns do these related tables have?
  for (const tbl of ["UserAccount", "UserAcctLocation", "UserGroup", "UserMap", "UpdateUser"]) {
    sections.push(
      await runQuery(
        `cols_${tbl}`,
        `SELECT c.name AS column_name, t.name AS data_type, c.is_nullable
         FROM prism_security.sys.columns c
         INNER JOIN prism_security.sys.types t ON t.user_type_id = c.user_type_id
         WHERE c.object_id = OBJECT_ID('prism_security.dbo.${tbl}')
         ORDER BY c.column_id;`,
      ),
    );
  }

  // The actual data for Marcos (SUID 865)
  sections.push(
    await runQuery(
      "useraccount_marcos",
      `SELECT * FROM prism_security.dbo.UserAccount WHERE SUID = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username)`,
      [{ name: "username", value: username }],
    ),
  );

  sections.push(
    await runQuery(
      "useracctlocation_marcos",
      `SELECT ual.*, l.Description AS LocationDesc
       FROM prism_security.dbo.UserAcctLocation ual
       LEFT JOIN Location l ON l.LocationID = ual.LocationID
       WHERE ual.SUID = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username)`,
      [{ name: "username", value: username }],
    ),
  );

  sections.push(
    await runQuery(
      "usermap_marcos",
      `SELECT * FROM prism_security.dbo.UserMap WHERE SUID = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username)`,
      [{ name: "username", value: username }],
    ),
  );

  // POS-side activity: which registers and locations has he used?
  sections.push(
    await runQuery(
      "register_access_history",
      `SELECT TOP 10 * FROM POS_Register_Access_History
       WHERE UserID = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username)
       ORDER BY 1 DESC`,
      [{ name: "username", value: username }],
    ),
  );

  // Other write activity counts
  sections.push(
    await runQuery(
      "write_activity_summary",
      `DECLARE @suid int = (SELECT TOP 1 SUID FROM prism_security.dbo.PrismUser WHERE UserName = @username);
       SELECT 'Acct_ARInvoice_Header' AS [table], COUNT(*) AS rows_authored FROM Acct_ARInvoice_Header WHERE UserID = @suid
       UNION ALL SELECT 'Catalog_Sales_Header', COUNT(*) FROM Catalog_Sales_Header WHERE UserID = @suid
       UNION ALL SELECT 'CRT_Header', COUNT(*) FROM CRT_Header WHERE UserID = @suid
       UNION ALL SELECT 'Invoice_Header', COUNT(*) FROM Invoice_Header WHERE UserID = @suid
       UNION ALL SELECT 'MR_Header', COUNT(*) FROM MR_Header WHERE UserID = @suid
       UNION ALL SELECT 'PO_Header', COUNT(*) FROM PO_Header WHERE UserID = @suid
       UNION ALL SELECT 'PO_Receive', COUNT(*) FROM PO_Receive WHERE UserID = @suid
       UNION ALL SELECT 'PriceChange', COUNT(*) FROM PriceChange WHERE UserID = @suid
       UNION ALL SELECT 'Acct_Memb_Header', COUNT(*) FROM Acct_Memb_Header WHERE UserID = @suid
       UNION ALL SELECT 'PackageHeader', COUNT(*) FROM PackageHeader WHERE UserID = @suid
       ORDER BY rows_authored DESC`,
      [{ name: "username", value: username }],
    ),
  );

  for (const s of sections) {
    const tag = (s as any).errored ? "ERRORED" : `rows=${s.rowCount}`;
    console.log(`[${s.name}]  ${tag}`);
    if ((s as any).errored) {
      console.log(`   ! ${trunc((s as any).errored, 200)}`);
      continue;
    }
    if (s.rowCount === 0) {
      console.log("   (no rows)");
      continue;
    }
    for (const r of s.rows.slice(0, 25) as Record<string, unknown>[]) {
      const cols = Object.entries(r)
        .map(([k, v]) => `${k}=${trunc(v, 100)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    console.log();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
