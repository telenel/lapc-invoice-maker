/**
 * READ-ONLY. Reverse-engineer Pierce's agency-cloning pattern (the
 * "mirror from a previous account" workflow used to create per-semester
 * agency replicas like PSP25EOPS → PSP26EOPS).
 *
 * Strictly SELECT-only. No INSERT/UPDATE/DELETE/MERGE/EXEC of writing
 * procs, no DDL.
 *
 * Usage: npx tsx scripts/probe-prism-agency-cloning.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool } from "@/lib/prism";

type Section = { name: string; rowCount: number; rows: unknown[]; errored?: string };

async function runQuery(label: string, query: string, params: { name: string; value: unknown }[] = []): Promise<Section> {
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

function trunc(s: unknown, max = 200): string {
  if (s === null || s === undefined) return "<null>";
  return String(s).replace(/\s+/g, " ").trim().slice(0, max);
}

async function main() {
  const sections: Section[] = [];

  // 1. Pierce agency naming pattern: extract semester-prefix and suffix
  //    Pattern: P + (SP|FA|SU|WI|...) + 2-digit year + suffix
  //    Example: PSP24EOPS → prefix=PSP, year=24, suffix=EOPS
  sections.push(
    await runQuery(
      "pierce_naming_patterns",
      `
      WITH pierce_agencies AS (
        SELECT
          AgencyID,
          RTRIM(AgencyNumber) AS num,
          Name,
          AgencyTypeID
        FROM Acct_Agency
        WHERE AgencyNumber LIKE 'P%'
      )
      SELECT
        LEFT(num, 5) AS prefix5,
        COUNT(*) AS n,
        MIN(num) AS sample_min,
        MAX(num) AS sample_max
      FROM pierce_agencies
      GROUP BY LEFT(num, 5)
      ORDER BY n DESC
      `,
    ),
  );

  // 2. Specifically: 5-character prefix that looks like P+SemCode+YY (5 chars)
  //    Catches PSP24, PSP25, PFA23, PSU22, etc.
  sections.push(
    await runQuery(
      "pierce_semester_prefixes",
      `
      WITH pierce_agencies AS (
        SELECT
          AgencyID,
          RTRIM(AgencyNumber) AS num
        FROM Acct_Agency
        WHERE AgencyNumber LIKE 'P[A-Z][A-Z]%'
          AND LEN(RTRIM(AgencyNumber)) >= 5
      ),
      with_parts AS (
        SELECT
          AgencyID,
          num,
          LEFT(num, 3) AS sem_prefix,    -- 'PSP'
          SUBSTRING(num, 4, 2) AS yr,    -- '24'
          SUBSTRING(num, 6, 30) AS suffix
        FROM pierce_agencies
        WHERE SUBSTRING(num, 4, 2) LIKE '[0-9][0-9]'
      )
      SELECT
        sem_prefix,
        yr,
        COUNT(*) AS n
      FROM with_parts
      GROUP BY sem_prefix, yr
      ORDER BY sem_prefix, yr DESC
      `,
    ),
  );

  // 3. Recurring suffixes — agencies whose suffix repeats across multiple
  //    (semester, year) pairs. These are the "template" candidates.
  sections.push(
    await runQuery(
      "recurring_template_suffixes",
      `
      WITH pierce_agencies AS (
        SELECT
          AgencyID,
          RTRIM(AgencyNumber) AS num,
          RTRIM(Name) AS name,
          AgencyTypeID,
          fInvoiceInAR,
          fBilling
        FROM Acct_Agency
        WHERE AgencyNumber LIKE 'P[A-Z][A-Z]%'
          AND LEN(RTRIM(AgencyNumber)) >= 6
      ),
      with_parts AS (
        SELECT
          AgencyID, num, name, AgencyTypeID, fInvoiceInAR, fBilling,
          LEFT(num, 3) AS sem_prefix,
          SUBSTRING(num, 4, 2) AS yr,
          SUBSTRING(num, 6, 30) AS suffix
        FROM pierce_agencies
        WHERE SUBSTRING(num, 4, 2) LIKE '[0-9][0-9]'
      ),
      by_suffix AS (
        SELECT
          suffix,
          COUNT(DISTINCT yr + sem_prefix) AS distinct_semesters,
          COUNT(*) AS instance_count,
          MIN(num) AS sample_oldest,
          MAX(num) AS sample_newest
        FROM with_parts
        WHERE LEN(suffix) > 0
        GROUP BY suffix
      )
      SELECT TOP 40 *
      FROM by_suffix
      WHERE distinct_semesters >= 2
      ORDER BY distinct_semesters DESC, instance_count DESC
      `,
    ),
  );

  // 4. Pick a recurring template (EOPS, the canonical example) and dump all
  //    instances side-by-side to see what changes vs stays constant.
  sections.push(
    await runQuery(
      "eops_instances_all_columns",
      `
      SELECT
        AgencyID,
        RTRIM(AgencyNumber) AS AgencyNumber,
        RTRIM(Name) AS Name,
        AgencyTypeID,
        StatementCodeID,
        AcctTermID,
        DiscountCodeID,
        ChangeLimit, CreditLimit, MimimumCharge, FinanceRate,
        MaxDays,
        TenderCode,
        NonMerchOptID,
        HalfReceiptTemplateID, FullReceiptTemplateID,
        fTaxExempt, fBalanceType, fBilling, fSetCredLimit, fStatus, fDebit,
        fInvoiceInAR, fAccessibleOnline, fPrintBalance, PrtStartExpDate,
        TextbookValidation, ValidateTextbooksOnly,
        Address, City, State, PostalCode,
        Contact, Phone1
      FROM Acct_Agency
      WHERE AgencyNumber LIKE 'P%EOPS%'
      ORDER BY AgencyNumber DESC
      `,
    ),
  );

  // 5. Same drill for another common template — generic department patterns
  sections.push(
    await runQuery(
      "anthro_instances",
      `
      SELECT
        AgencyID,
        RTRIM(AgencyNumber) AS AgencyNumber,
        RTRIM(Name) AS Name,
        AgencyTypeID,
        StatementCodeID,
        TenderCode,
        NonMerchOptID,
        fInvoiceInAR,
        fBilling
      FROM Acct_Agency
      WHERE AgencyNumber LIKE 'P%ANTHRO%'
      ORDER BY AgencyNumber DESC
      `,
    ),
  );

  // 6. How many distinct semester replicas does Pierce maintain?
  sections.push(
    await runQuery(
      "pierce_semester_summary",
      `
      WITH pierce_agencies AS (
        SELECT RTRIM(AgencyNumber) AS num
        FROM Acct_Agency
        WHERE AgencyNumber LIKE 'P[A-Z][A-Z]%'
          AND LEN(RTRIM(AgencyNumber)) >= 6
      ),
      with_parts AS (
        SELECT
          LEFT(num, 5) AS sem,
          SUBSTRING(num, 6, 30) AS suffix
        FROM pierce_agencies
        WHERE SUBSTRING(num, 4, 2) LIKE '[0-9][0-9]'
      )
      SELECT sem, COUNT(*) AS agencies_in_semester
      FROM with_parts
      GROUP BY sem
      ORDER BY sem DESC
      `,
    ),
  );

  // 7. Acct_Agency_Customer linkage for EOPS instances — does the customer
  //    contact mirror across semesters too?
  sections.push(
    await runQuery(
      "eops_customer_linkage",
      `
      SELECT
        a.AgencyID,
        RTRIM(a.AgencyNumber) AS AgencyNumber,
        RTRIM(a.Name) AS Name,
        ac.AgencyCustID,
        ac.CustomerID,
        ac.StartDate,
        ac.ExpDate,
        ac.PayDate,
        ac.IssueDate,
        ac.fStatus,
        ac.CreditLimit,
        ac.PIN,
        ac.StandingPO
      FROM Acct_Agency a
      LEFT JOIN Acct_Agency_Customer ac ON ac.AgencyID = a.AgencyID
      WHERE a.AgencyNumber LIKE 'P%EOPS%'
      ORDER BY a.AgencyNumber DESC, ac.AgencyCustID
      `,
    ),
  );

  // 8. Acct_Agency_DCC — DCC permissions per Pierce template
  sections.push(
    await runQuery(
      "eops_dcc_permissions",
      `
      SELECT
        a.AgencyID,
        RTRIM(a.AgencyNumber) AS AgencyNumber,
        adcc.AgencyDCCID,
        adcc.DCCID,
        adcc.DCCMask,
        adcc.Discount
      FROM Acct_Agency a
      LEFT JOIN Acct_Agency_DCC adcc ON adcc.AgencyID = a.AgencyID
      WHERE a.AgencyNumber LIKE 'P%EOPS%'
      ORDER BY a.AgencyNumber DESC, adcc.DCCID
      `,
    ),
  );

  // 9. Acct_Agency_NonMerch — non-merch fee codes per template
  sections.push(
    await runQuery(
      "eops_nonmerch",
      `
      SELECT
        a.AgencyID,
        RTRIM(a.AgencyNumber) AS AgencyNumber,
        anm.AcctAgncyNMrchID,
        anm.fG3,
        RTRIM(anm.FeeCodeDescr) AS FeeCodeDescr
      FROM Acct_Agency a
      LEFT JOIN Acct_Agency_NonMerch anm ON anm.AgencyID = a.AgencyID
      WHERE a.AgencyNumber LIKE 'P%EOPS%'
      ORDER BY a.AgencyNumber DESC, anm.AcctAgncyNMrchID
      `,
    ),
  );

  // 10. Recovery: SP_AcctAgencyCopyDCC body — the proc that clones DCC perms
  sections.push(
    await runQuery(
      "sp_copydcc_body",
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
        ) AS statement_text
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
      WHERE OBJECT_NAME(st.objectid, st.dbid) = 'SP_AcctAgencyCopyDCC'
      ORDER BY qs.statement_start_offset
      `,
    ),
  );

  // 11. SP_AcctAgencyCopyNonMerch body
  sections.push(
    await runQuery(
      "sp_copynonmerch_body",
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
        ) AS statement_text
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
      WHERE OBJECT_NAME(st.objectid, st.dbid) = 'SP_AcctAgencyCopyNonMerch'
      ORDER BY qs.statement_start_offset
      `,
    ),
  );

  // 12. Other agency-related procedure_stats — what's been called recently?
  sections.push(
    await runQuery(
      "agency_proc_stats",
      `
      SELECT TOP 15
        OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
        ps.execution_count,
        ps.last_execution_time
      FROM sys.dm_exec_procedure_stats ps
      WHERE OBJECT_NAME(ps.object_id, ps.database_id) LIKE '%Agency%'
         OR OBJECT_NAME(ps.object_id, ps.database_id) LIKE 'SP[_]AR[_]Acct%'
      ORDER BY ps.last_execution_time DESC
      `,
    ),
  );

  // 13. Account terms lookup — what semester-relevant terms exist?
  sections.push(
    await runQuery(
      "acct_terms_header",
      `
      SELECT TOP 30 *
      FROM Acct_Terms_Header
      ORDER BY AcctTermID
      `,
    ),
  );

  // 14. Recent template work — Stella + Michael's recently-created agencies
  //     (any from the last 12 months that look like semester replicas)
  sections.push(
    await runQuery(
      "recent_pierce_template_creates",
      `
      WITH pierce_recent AS (
        SELECT a.AgencyID, RTRIM(a.AgencyNumber) AS num, RTRIM(a.Name) AS name
        FROM Acct_Agency a
        WHERE a.AgencyNumber LIKE 'P[A-Z][A-Z]2[5-6]%'
      )
      SELECT TOP 40 num, name
      FROM pierce_recent
      ORDER BY num DESC
      `,
    ),
  );

  // 15. For each template suffix that recurs, find the typical UserID who
  //     creates them — but Acct_Agency itself has no UserID column. Use a
  //     proxy: who has been editing the linked Acct_Agency_Customer rows
  //     recently for these agencies? (Skip if not informative.)

  // Print
  console.log("\n=== Agency Cloning Probe ===\n");
  for (const s of sections) {
    const tag = s.errored ? "ERRORED" : `rows=${s.rowCount}`;
    console.log(`[${s.name}]  ${tag}`);
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
        .map(([k, v]) => `${k}=${trunc(v, 100)}`)
        .join("  ");
      console.log(`   ${cols}`);
    }
    if (s.rowCount > 30) console.log(`   … (${s.rowCount - 30} more rows)`);
    console.log();
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(tmpDir, `prism-agency-cloning-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sections, null, 2));
  console.log(`Full results: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
