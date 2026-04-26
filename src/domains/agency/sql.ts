/**
 * Pure SQL builders for the agency domain.
 *
 * These compose parameterized SQL strings. They never execute anything;
 * the agency-server module wires the SQL into a Prism connection pool and
 * a transaction. Splitting composition from execution makes the SQL
 * unit-testable without a database.
 *
 * Authoritative reference for the column contract:
 *   docs/prism/static/actions/agency-binary-findings.md §2 (53 MFC-bound columns)
 *   docs/prism/static/actions/clone-ar-agency.md §6
 */

/**
 * The 53 MFC-bound columns from WPData.dll's CARAgencySet recordset, in MFC
 * order. Used for both create-from-scratch and clone (INSERT..SELECT).
 *
 * Excludes:
 *   - AgencyID (IDENTITY — populated by SCOPE_IDENTITY)
 *   - txComment (not in the comprehensive WPData.dll binding; Pierce sets ~1%)
 *   - fStatus (system column — not bound by MFC)
 */
export const ACCT_AGENCY_INSERT_COLUMNS: ReadonlyArray<string> = Object.freeze([
  "AgencyNumber",
  "Name",
  "AgencyTypeID",
  "fDebit",
  "AgencyBillingID",
  "MaxDays",
  "Priority",
  "StatementCodeID",
  "AcctTermID",
  "DiscountCodeID",
  "ChangeLimit",
  "CreditLimit",
  "MimimumCharge", // intentional misspelling — matches schema
  "FinanceRate",
  "FedTaxNumber",
  "Contact",
  "Address",
  "City",
  "State",
  "Country",
  "PostalCode",
  "Phone1",
  "Phone2",
  "Phone3",
  "Ext1",
  "Ext2",
  "Ext3",
  "fBilling",
  "fBalanceType",
  "fFinanceType",
  "fFinanceCharge",
  "fTaxExempt",
  "fSetCredLimit",
  "fPageBreak",
  "TenderCode",
  "DiscountType",
  "PrintInvoice",
  "fPermitChgDue",
  "fOpenDrawer",
  "fRefRequired",
  "fAccessibleOnline",
  "fAllowLimitChg",
  "HalfReceiptTemplateID",
  "FullReceiptTemplateID",
  "fInvoiceInAR",
  "NonMerchOptID",
  "fPrintBalance",
  "fDispCustCmnt",
  "fPrtCustCmnt",
  "PrtStartExpDate",
  "TextbookValidation",
  "ValidateTextbooksOnly",
]);

/**
 * Build the INSERT..SELECT statement that clones an Acct_Agency row.
 *
 * Returns a SQL string that:
 *   1. Inserts a new Acct_Agency row by SELECTing every column from the source
 *      row, except @newAgencyNumber and @newName which are caller-supplied.
 *   2. Captures SCOPE_IDENTITY() into a result row so the caller can read
 *      back the new AgencyID.
 *
 * The SQL has two named parameters (bound via mssql request.input()):
 *   - @sourceAgencyId (Int)
 *   - @newAgencyNumber (Char(26))
 *   - @newName (VarChar(80))
 */
export function buildCloneAgencySql(): string {
  const cols = ACCT_AGENCY_INSERT_COLUMNS;
  const insertList = cols.join(", ");
  const selectList = cols
    .map((col) => {
      if (col === "AgencyNumber") return "@newAgencyNumber";
      if (col === "Name") return "@newName";
      return col;
    })
    .join(", ");

  return [
    `INSERT INTO Acct_Agency (${insertList})`,
    `SELECT ${selectList}`,
    `FROM Acct_Agency`,
    `WHERE AgencyID = @sourceAgencyId;`,
    `SELECT CAST(SCOPE_IDENTITY() AS int) AS newAgencyId;`,
  ].join("\n");
}

/**
 * Build the parameterized INSERT statement for creating a new Acct_Agency
 * row from caller-supplied values. The 52 MFC-bound columns are all bound
 * positionally by name; the caller must supply a value (or NULL) for each
 * via mssql request.input(`p_<columnName>`, ...).
 *
 * The agency-server layer provides Pierce defaults for any column the
 * caller doesn't specify.
 */
export function buildCreateAgencySql(): string {
  const cols = ACCT_AGENCY_INSERT_COLUMNS;
  const insertList = cols.join(", ");
  const valuesList = cols.map((col) => `@p_${col}`).join(", ");

  return [
    `INSERT INTO Acct_Agency (${insertList})`,
    `VALUES (${valuesList});`,
    `SELECT CAST(SCOPE_IDENTITY() AS int) AS newAgencyId;`,
  ].join("\n");
}

/**
 * Build the SELECT statement that searches Pierce agencies by AgencyNumber
 * or Name. Used by the template-picker in the single-agency create flow.
 *
 * Bound parameters:
 *   - @q (VarChar(80)) — match string. Used in LIKE '%...%' on both columns.
 *   - @limit (Int) — max rows returned (typically 25–50)
 */
export function buildSearchAgenciesSql(): string {
  return [
    `SELECT TOP (@limit)`,
    `  AgencyID         AS agencyId,`,
    `  LTRIM(RTRIM(AgencyNumber)) AS agencyNumber,`,
    `  LTRIM(RTRIM(Name))         AS name,`,
    `  AgencyTypeID     AS agencyTypeId,`,
    `  CreditLimit      AS creditLimit,`,
    `  TenderCode       AS tenderCode,`,
    `  fStatus          AS fStatus,`,
    `  fAccessibleOnline AS fAccessibleOnline,`,
    `  fSetCredLimit    AS fSetCredLimit`,
    `FROM Acct_Agency`,
    `WHERE`,
    `  -- Pierce-only filter`,
    `  (AgencyNumber LIKE 'PSP%'`,
    `    OR AgencyNumber LIKE 'PFA%'`,
    `    OR AgencyNumber LIKE 'PSU%'`,
    `    OR AgencyNumber LIKE 'PWI%'`,
    `    OR AgencyNumber LIKE 'PW%'`,
    `    OR AgencyNumber LIKE 'PS%'`,
    `    OR AgencyNumber LIKE 'PF%')`,
    `  AND (AgencyNumber LIKE '%' + @q + '%' OR Name LIKE '%' + @q + '%')`,
    `ORDER BY AgencyNumber DESC;`,
  ].join("\n");
}

/**
 * Build the SELECT statement that fetches one Acct_Agency row by ID.
 * Returns the same shape as buildListBySemesterSql() (AgencyRecord).
 *
 * Bound parameter: @agencyId (Int).
 */
export function buildGetAgencyByIdSql(): string {
  return [
    `SELECT`,
    `  AgencyID         AS agencyId,`,
    `  LTRIM(RTRIM(AgencyNumber)) AS agencyNumber,`,
    `  LTRIM(RTRIM(Name))         AS name,`,
    `  AgencyTypeID     AS agencyTypeId,`,
    `  CreditLimit      AS creditLimit,`,
    `  TenderCode       AS tenderCode,`,
    `  fStatus          AS fStatus,`,
    `  fAccessibleOnline AS fAccessibleOnline,`,
    `  fSetCredLimit    AS fSetCredLimit`,
    `FROM Acct_Agency`,
    `WHERE AgencyID = @agencyId;`,
  ].join("\n");
}

/**
 * Build the SELECT statement that lists Pierce agencies whose AgencyNumber
 * starts with the given semester prefix. Used to find rollover candidates.
 *
 * Bound parameters:
 *   - @prefix (VarChar(26)) — e.g. 'PWI25'
 */
export function buildListBySemesterSql(): string {
  return [
    `SELECT`,
    `  AgencyID         AS agencyId,`,
    `  LTRIM(RTRIM(AgencyNumber)) AS agencyNumber,`,
    `  LTRIM(RTRIM(Name))         AS name,`,
    `  AgencyTypeID     AS agencyTypeId,`,
    `  CreditLimit      AS creditLimit,`,
    `  TenderCode       AS tenderCode,`,
    `  fStatus          AS fStatus,`,
    `  fAccessibleOnline AS fAccessibleOnline,`,
    `  fSetCredLimit    AS fSetCredLimit`,
    `FROM Acct_Agency`,
    `WHERE AgencyNumber LIKE @prefix + '%'`,
    `ORDER BY AgencyNumber;`,
  ].join("\n");
}

/**
 * Build the SELECT statement that returns the existing AgencyNumbers for a
 * given semester prefix — used to detect collisions before cloning.
 *
 * Bound parameter: @prefix (VarChar(26)).
 */
export function buildExistingAgencyNumbersSql(): string {
  return [
    `SELECT LTRIM(RTRIM(AgencyNumber)) AS agencyNumber`,
    `FROM Acct_Agency`,
    `WHERE AgencyNumber LIKE @prefix + '%';`,
  ].join("\n");
}

/**
 * Distinct semester prefixes that exist in Acct_Agency, sorted newest-first.
 * Returns rows of {prefix, agencyCount}.
 *
 * Filters to Pierce convention: P[A-Z][A-Z]\d\d (or single-letter season).
 */
export function buildPierceSemestersSql(): string {
  return [
    `SELECT`,
    `  LEFT(LTRIM(RTRIM(AgencyNumber)), 5) AS prefix,`,
    `  COUNT(*) AS agencyCount`,
    `FROM Acct_Agency`,
    `WHERE AgencyNumber LIKE 'PSP%'`,
    `   OR AgencyNumber LIKE 'PFA%'`,
    `   OR AgencyNumber LIKE 'PSU%'`,
    `   OR AgencyNumber LIKE 'PWI%'`,
    `GROUP BY LEFT(LTRIM(RTRIM(AgencyNumber)), 5)`,
    `ORDER BY prefix DESC;`,
  ].join("\n");
}

/**
 * Compute the target AgencyNumber by replacing the leading source prefix with
 * the target prefix.
 *
 * Examples:
 *   computeTargetAgencyNumber('PWI25EOPSDEPT', 'PWI25', 'PWI26') → 'PWI26EOPSDEPT'
 *   computeTargetAgencyNumber('PSP25USVETS',   'PSP25', 'PSP26') → 'PSP26USVETS'
 *
 * Throws if the source AgencyNumber does not start with the source prefix.
 */
export function computeTargetAgencyNumber(
  sourceAgencyNumber: string,
  sourcePrefix: string,
  targetPrefix: string,
): string {
  const trimmed = sourceAgencyNumber.trim();
  if (!trimmed.startsWith(sourcePrefix)) {
    throw new Error(
      `AgencyNumber '${trimmed}' does not start with expected source prefix '${sourcePrefix}'`,
    );
  }
  return targetPrefix + trimmed.slice(sourcePrefix.length);
}

/**
 * Compute the target Name. For modern agencies, Name === AgencyNumber, so a
 * direct prefix swap is correct. For older verbose names like
 * 'PIERCE WINTER 2023 EOPS DEPARTMENT' we attempt to substitute the year.
 *
 * If the source Name equals the source AgencyNumber, swap it the same way.
 * Otherwise, do a simple year-substitution (e.g. 2023 -> 2024) when possible;
 * fall back to mirroring the source Name unchanged.
 */
export function computeTargetName(
  sourceName: string,
  sourceAgencyNumber: string,
  targetAgencyNumber: string,
): string {
  const trimmedName = sourceName.trim();
  const trimmedSource = sourceAgencyNumber.trim();

  // Modern pattern: Name == AgencyNumber. Mirror the swap.
  if (trimmedName === trimmedSource) {
    return targetAgencyNumber;
  }

  // Old verbose pattern: try year substitution (2023 → 2024, 2025 → 2026).
  // Prefix carries 2-digit year at positions 3-5: 'PWI25' → '25' → 2025.
  const sourcePrefixYY = sourceAgencyNumber.slice(3, 5);
  const targetPrefixYY = targetAgencyNumber.slice(3, 5);
  if (
    /^\d{2}$/.test(sourcePrefixYY) &&
    /^\d{2}$/.test(targetPrefixYY) &&
    sourcePrefixYY !== targetPrefixYY
  ) {
    const sourceFullYear = `20${sourcePrefixYY}`;
    const targetFullYear = `20${targetPrefixYY}`;
    if (trimmedName.includes(sourceFullYear)) {
      return trimmedName.split(sourceFullYear).join(targetFullYear);
    }
  }

  return trimmedName;
}
