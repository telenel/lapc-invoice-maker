/**
 * Server-side service for the agency domain.
 *
 * These functions wire the pure SQL builders (sql.ts) to the Prism connection
 * pool. They are intended to be called only from API routes; never from
 * client components.
 *
 * Reference docs:
 *   docs/prism/static/actions/clone-ar-agency.md
 *   docs/prism/static/actions/agency-binary-findings.md
 *
 * Read-only functions: agencyExists, listAgenciesBySemester, listPierceSemesters,
 * previewRollSemester.
 *
 * Write functions: cloneAgency, rollSemesterForward.
 *   These issue INSERT INTO Acct_Agency + EXEC SP_AcctAgencyCopyDCC +
 *   EXEC SP_AcctAgencyCopyNonMerch + EXEC SP_ARAcctResendToPos. Per the
 *   read-only rule (CLAUDE.md), these are only acceptable from real user
 *   clicks in the shipped UI — not from autonomous test invocations.
 */
import { getPrismPool, sql } from "@/lib/prism";
import {
  buildCloneAgencySql,
  buildCreateAgencySql,
  buildExistingAgencyNumbersSql,
  buildGetAgencyByIdSql,
  buildListBySemesterSql,
  buildPierceSemestersSql,
  buildSearchAgenciesSql,
  computeTargetAgencyNumber,
  computeTargetName,
} from "./sql";
import { PIERCE_AGENCY_DEFAULTS } from "./pierce-defaults";
import {
  validateCloneAgencyRequest,
  validateCreateAgencyRequest,
  validateRollSemesterRequest,
} from "./validation";
import type {
  AgencyRecord,
  CloneAgencyInput,
  CloneAgencyResult,
  CreateAgencyInput,
  CreateAgencyResult,
  RollPlanRow,
  RollSemesterPlan,
  RollSemesterResult,
} from "./types";

// ---------- Read paths ----------

/**
 * True if an Acct_Agency row already exists with the given AgencyNumber.
 * Trims whitespace because Prism stores AgencyNumber as char(26) (space-padded).
 */
export async function agencyExists(agencyNumber: string): Promise<boolean> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("agencyNumber", sql.VarChar(26), agencyNumber.trim())
    .query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM Acct_Agency WHERE LTRIM(RTRIM(AgencyNumber)) = @agencyNumber",
    );
  return (result.recordset[0]?.count ?? 0) > 0;
}

/**
 * Distinct Pierce semester prefixes (PSP/PFA/PSU/PWI + YY) currently in
 * Acct_Agency. Used to populate the source-semester dropdown.
 */
export async function listPierceSemesters(): Promise<
  Array<{ prefix: string; agencyCount: number }>
> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .query<{ prefix: string; agencyCount: number }>(buildPierceSemestersSql());
  return result.recordset.map((r) => ({
    prefix: r.prefix.trim(),
    agencyCount: Number(r.agencyCount),
  }));
}

/**
 * All agencies whose AgencyNumber starts with the given semester prefix.
 */
export async function listAgenciesBySemester(prefix: string): Promise<AgencyRecord[]> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("prefix", sql.VarChar(26), prefix.trim())
    .query<{
      agencyId: number;
      agencyNumber: string;
      name: string;
      agencyTypeId: number;
      creditLimit: number;
      tenderCode: number;
      fStatus: number;
      fAccessibleOnline: number;
      fSetCredLimit: number;
    }>(buildListBySemesterSql());
  return result.recordset;
}

/**
 * Existing AgencyNumbers (trimmed) for a given semester prefix. Used for
 * collision detection when planning a roll-forward.
 */
export async function listExistingAgencyNumbers(prefix: string): Promise<Set<string>> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("prefix", sql.VarChar(26), prefix.trim())
    .query<{ agencyNumber: string }>(buildExistingAgencyNumbersSql());
  return new Set(result.recordset.map((r) => r.agencyNumber.trim()));
}

/**
 * Search Pierce agencies by AgencyNumber or Name. Used by the
 * single-agency-create form's template-picker (mirror mode).
 *
 * Filters to Pierce naming convention (PSP/PFA/PSU/PWI prefixes plus the
 * older one-letter season variants). Returns at most `limit` rows, newest
 * AgencyNumber first.
 */
export async function searchAgencies(
  query: string,
  limit = 25,
): Promise<AgencyRecord[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("q", sql.VarChar(80), trimmed)
    .input("limit", sql.Int, Math.max(1, Math.min(limit, 100)))
    .query<AgencyRecord>(buildSearchAgenciesSql());
  return result.recordset;
}

/**
 * Fetch one Acct_Agency row by ID (Pierce-prefixed only — the search returns
 * non-Pierce IDs to nobody, but defense-in-depth: we don't filter here so
 * the caller can confirm the row exists exactly as expected).
 *
 * Returns null if no row exists.
 */
export async function getAgencyById(agencyId: number): Promise<AgencyRecord | null> {
  if (!Number.isInteger(agencyId) || agencyId <= 0) return null;
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("agencyId", sql.Int, agencyId)
    .query<AgencyRecord>(buildGetAgencyByIdSql());
  return result.recordset[0] ?? null;
}

export interface AgencyLookups {
  agencyTypes: Array<{ id: number; description: string }>;
  statementCodes: Array<{ id: number; description: string }>;
  nonMerchOpts: Array<{ id: number; description: string }>;
  tenderCodes: Array<{ id: number; description: string }>;
}

/**
 * Fetch the FK lookup tables the advanced create form needs to populate
 * its dropdowns. All read-only.
 *
 * tenderCodes is filtered to Pierce-relevant codes and active codes only,
 * to avoid showing 100+ irrelevant options.
 */
export async function getAgencyLookups(): Promise<AgencyLookups> {
  const pool = await getPrismPool();

  const [types, statementCodes, nonMerchOpts, tenderCodes] = await Promise.all([
    pool.request().query<{ id: number; description: string }>(
      `SELECT AgencyTypeID AS id, LTRIM(RTRIM(Description)) AS description
       FROM Acct_Agency_Type ORDER BY AgencyTypeID`,
    ),
    pool.request().query<{ id: number; description: string }>(
      `SELECT StatementCodeID AS id, LTRIM(RTRIM(Description)) AS description
       FROM Acct_Statement_Codes ORDER BY StatementCodeID`,
    ),
    pool.request().query<{ id: number; description: string }>(
      `SELECT NonMerchOptID AS id, LTRIM(RTRIM(Description)) AS description
       FROM Acct_Agency_Non_Merch_Opt ORDER BY NonMerchOptID`,
    ),
    pool.request().query<{ id: number; description: string }>(
      `SELECT TenderCodeID AS id, LTRIM(RTRIM(Description)) AS description
       FROM Tender_Codes
       WHERE fDisable = 0
       ORDER BY TenderCodeID`,
    ),
  ]);

  return {
    agencyTypes: types.recordset,
    statementCodes: statementCodes.recordset,
    nonMerchOpts: nonMerchOpts.recordset,
    tenderCodes: tenderCodes.recordset,
  };
}

/**
 * Full preview of a semester rollover. Returns every source agency, its
 * computed target AgencyNumber/Name, and whether the target already exists.
 *
 * Read-only. Safe to call any number of times.
 */
export async function previewRollSemester(
  sourceSemester: string,
  targetSemester: string,
): Promise<RollSemesterPlan> {
  const validation = validateRollSemesterRequest({ sourceSemester, targetSemester });
  if (!validation.ok) {
    throw new Error(validation.errors.map((e) => e.message).join(" "));
  }

  const [sources, existingTargets] = await Promise.all([
    listAgenciesBySemester(sourceSemester),
    listExistingAgencyNumbers(targetSemester),
  ]);

  const rows: RollPlanRow[] = sources.map((source) => {
    const targetAgencyNumber = computeTargetAgencyNumber(
      source.agencyNumber,
      sourceSemester,
      targetSemester,
    );
    const targetName = computeTargetName(
      source.name,
      source.agencyNumber,
      targetAgencyNumber,
    );
    return {
      source,
      targetAgencyNumber,
      targetName,
      alreadyExists: existingTargets.has(targetAgencyNumber),
    };
  });

  return { sourceSemester, targetSemester, rows };
}

// ---------- Write paths ----------

/**
 * Clone one agency. Issues:
 *   1. INSERT INTO Acct_Agency ... SELECT ... FROM Acct_Agency WHERE AgencyID = @sourceAgencyId
 *   2. SCOPE_IDENTITY() to read back newAgencyId
 *   3. EXEC SP_AcctAgencyCopyDCC @NewAgencyID, @OldAgencyID
 *   4. EXEC SP_AcctAgencyCopyNonMerch @NewAgencyID, @OldAgencyID
 *   5. EXEC SP_ARAcctResendToPos @AgencyID
 *
 * Wrapped in a single transaction. The TI_Acct_Agency trigger fires
 * automatically and Cartesian-populates Acct_Agency_Tax_Codes.
 *
 * Throws if the target AgencyNumber already exists (caller should pre-check
 * via agencyExists or previewRollSemester).
 */
export async function cloneAgency(input: CloneAgencyInput): Promise<CloneAgencyResult> {
  const validation = validateCloneAgencyRequest(input);
  if (!validation.ok) {
    throw new Error(validation.errors.map((e) => e.message).join(" "));
  }

  const newAgencyNumber = input.newAgencyNumber.trim();
  const newName = input.newName.trim();

  // Pre-check: refuse if the target already exists. WPAdmin's UI rule:
  // "select count(*) from acct_agency where AgencyNumber = '%s'" → refuse if > 0.
  if (await agencyExists(newAgencyNumber)) {
    throw new Error(
      `Account Code '${newAgencyNumber}' already exists. Refusing to create a duplicate.`,
    );
  }

  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Step 1+2: INSERT..SELECT and capture SCOPE_IDENTITY
    const insertRequest = transaction.request();
    insertRequest.input("sourceAgencyId", sql.Int, input.sourceAgencyId);
    insertRequest.input("newAgencyNumber", sql.Char(26), newAgencyNumber);
    insertRequest.input("newName", sql.VarChar(80), newName);
    const insertResult = await insertRequest.query<{ newAgencyId: number }>(
      buildCloneAgencySql(),
    );

    const newAgencyId = Number(insertResult.recordset[0]?.newAgencyId);
    if (!Number.isFinite(newAgencyId) || newAgencyId <= 0) {
      throw new Error("Acct_Agency INSERT did not return a valid SCOPE_IDENTITY");
    }

    // Step 3: SP_AcctAgencyCopyDCC — NEW first, OLD second (verified signature).
    await transaction
      .request()
      .input("NewAgencyID", sql.Int, newAgencyId)
      .input("OldAgencyID", sql.Int, input.sourceAgencyId)
      .execute("SP_AcctAgencyCopyDCC");

    // Step 4: SP_AcctAgencyCopyNonMerch — same param order.
    await transaction
      .request()
      .input("NewAgencyID", sql.Int, newAgencyId)
      .input("OldAgencyID", sql.Int, input.sourceAgencyId)
      .execute("SP_AcctAgencyCopyNonMerch");

    // Step 5: SP_ARAcctResendToPos — push to register-local POS DBs.
    await transaction
      .request()
      .input("AgencyID", sql.Int, newAgencyId)
      .execute("SP_ARAcctResendToPos");

    await transaction.commit();

    return {
      newAgencyId,
      newAgencyNumber,
      newName,
    };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      /* swallow rollback failures */
    }
    throw err;
  }
}

export interface RollSemesterExecuteInput {
  sourceSemester: string;
  targetSemester: string;
  /**
   * AgencyIDs the caller has selected to roll forward. The UI presents the
   * full preview list with checkboxes; only the IDs in this set are cloned.
   * Defaults to "every preview row that doesn't already exist" if omitted.
   */
  selectedSourceAgencyIds?: ReadonlySet<number>;
}

/**
 * Execute a bulk semester rollover. For each selected source agency that
 * doesn't already have a target counterpart, clone it. Each clone runs in
 * its own transaction so a single failure doesn't undo prior successes.
 *
 * Returns a summary the caller logs to the laportal-side audit table.
 */
export async function rollSemesterForward(
  input: RollSemesterExecuteInput,
): Promise<RollSemesterResult & { errors: Array<{ sourceAgencyNumber: string; error: string }> }> {
  const plan = await previewRollSemester(input.sourceSemester, input.targetSemester);

  const created: RollSemesterResult["created"] = [];
  const skipped: RollSemesterResult["skipped"] = [];
  const errors: Array<{ sourceAgencyNumber: string; error: string }> = [];

  for (const row of plan.rows) {
    const isSelected =
      input.selectedSourceAgencyIds === undefined ||
      input.selectedSourceAgencyIds.has(row.source.agencyId);

    if (!isSelected) {
      skipped.push({
        sourceAgencyNumber: row.source.agencyNumber,
        targetAgencyNumber: row.targetAgencyNumber,
        reason: "deselected",
      });
      continue;
    }

    if (row.alreadyExists) {
      skipped.push({
        sourceAgencyNumber: row.source.agencyNumber,
        targetAgencyNumber: row.targetAgencyNumber,
        reason: "already_exists",
      });
      continue;
    }

    try {
      const result = await cloneAgency({
        sourceAgencyId: row.source.agencyId,
        newAgencyNumber: row.targetAgencyNumber,
        newName: row.targetName,
      });
      created.push({
        sourceAgencyId: row.source.agencyId,
        sourceAgencyNumber: row.source.agencyNumber,
        newAgencyId: result.newAgencyId,
        newAgencyNumber: result.newAgencyNumber,
      });
    } catch (err) {
      errors.push({
        sourceAgencyNumber: row.source.agencyNumber,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    sourceSemester: input.sourceSemester,
    targetSemester: input.targetSemester,
    created,
    skipped,
    errors,
  };
}

/**
 * Create a new Acct_Agency from scratch (no template). The 52 MFC-bound
 * columns are all bound; caller-supplied fields override Pierce defaults.
 *
 * Same post-INSERT pattern as cloneAgency:
 *   - TI_Acct_Agency trigger fires (auto-populates Acct_Agency_Tax_Codes)
 *   - SP_ARAcctResendToPos pushes to register POS DBs
 *
 * Unlike clone, no DCC/NonMerch copy procs are called — the new agency
 * has no template, so there's nothing to copy from.
 *
 * Throws if AgencyNumber already exists, or if validation fails.
 */
export async function createAgency(
  input: CreateAgencyInput,
): Promise<CreateAgencyResult> {
  const validation = validateCreateAgencyRequest({
    agencyNumber: input.agencyNumber,
    name: input.name,
    agencyTypeId: input.agencyTypeId,
  });
  if (!validation.ok) {
    throw new Error(validation.errors.map((e) => e.message).join(" "));
  }

  const newAgencyNumber = input.agencyNumber.trim();
  const newName = input.name.trim();

  if (await agencyExists(newAgencyNumber)) {
    throw new Error(
      `Account Code '${newAgencyNumber}' already exists. Refusing to create a duplicate.`,
    );
  }

  // Resolve every column to either caller-supplied or Pierce default.
  // The CASE WHEN @CreditLimit > 0 THEN 1 logic from create-ar-agency.md
  // §6 is folded in here: fSetCredLimit auto-flips to 1 when CreditLimit > 0
  // unless caller explicitly overrides.
  const creditLimit = input.creditLimit ?? 0;
  const fSetCredLimit =
    input.fSetCredLimit ?? (creditLimit > 0 ? 1 : 0);

  const D = PIERCE_AGENCY_DEFAULTS;
  // mssql accepts both ISqlType (e.g. sql.VarChar(80)) and the no-arg factory
  // form (e.g. sql.Int). Both branches are valid second args to .input(), so
  // we type the type field loosely and let mssql validate at call time.
  type ParamSpec = { name: string; type: unknown; value: unknown };
  const params: ParamSpec[] = [
    { name: "p_AgencyNumber", type: sql.Char(26), value: newAgencyNumber },
    { name: "p_Name", type: sql.VarChar(80), value: newName },
    { name: "p_AgencyTypeID", type: sql.Int, value: input.agencyTypeId },
    { name: "p_fDebit", type: sql.TinyInt, value: input.fDebit ?? D.fDebit },
    { name: "p_AgencyBillingID", type: sql.Int, value: input.agencyBillingId ?? D.AgencyBillingID },
    { name: "p_MaxDays", type: sql.Int, value: input.maxDays ?? D.MaxDays },
    { name: "p_Priority", type: sql.Int, value: input.priority ?? D.Priority },
    { name: "p_StatementCodeID", type: sql.Int, value: input.statementCodeId ?? D.StatementCodeID },
    { name: "p_AcctTermID", type: sql.Int, value: input.acctTermId ?? D.AcctTermID },
    { name: "p_DiscountCodeID", type: sql.Int, value: input.discountCodeId ?? D.DiscountCodeID },
    { name: "p_ChangeLimit", type: sql.Money, value: input.changeLimit ?? D.ChangeLimit },
    { name: "p_CreditLimit", type: sql.Money, value: creditLimit },
    { name: "p_MimimumCharge", type: sql.Money, value: input.mimimumCharge ?? D.MimimumCharge },
    { name: "p_FinanceRate", type: sql.Decimal(7, 4), value: input.financeRate ?? D.FinanceRate },
    { name: "p_FedTaxNumber", type: sql.Char(15), value: input.fedTaxNumber ?? D.FedTaxNumber },
    { name: "p_Contact", type: sql.VarChar(80), value: input.contact ?? D.Contact },
    { name: "p_Address", type: sql.VarChar(80), value: input.address ?? D.Address },
    { name: "p_City", type: sql.VarChar(80), value: input.city ?? D.City },
    { name: "p_State", type: sql.VarChar(80), value: input.state ?? D.State },
    { name: "p_Country", type: sql.VarChar(80), value: input.country ?? D.Country },
    { name: "p_PostalCode", type: sql.VarChar(20), value: input.postalCode ?? D.PostalCode },
    { name: "p_Phone1", type: sql.VarChar(20), value: input.phone1 ?? D.Phone1 },
    { name: "p_Phone2", type: sql.VarChar(20), value: input.phone2 ?? D.Phone2 },
    { name: "p_Phone3", type: sql.VarChar(20), value: input.phone3 ?? D.Phone3 },
    { name: "p_Ext1", type: sql.VarChar(10), value: input.ext1 ?? D.Ext1 },
    { name: "p_Ext2", type: sql.VarChar(10), value: input.ext2 ?? D.Ext2 },
    { name: "p_Ext3", type: sql.VarChar(10), value: input.ext3 ?? D.Ext3 },
    { name: "p_fBilling", type: sql.TinyInt, value: input.fBilling ?? D.fBilling },
    { name: "p_fBalanceType", type: sql.TinyInt, value: input.fBalanceType ?? D.fBalanceType },
    { name: "p_fFinanceType", type: sql.TinyInt, value: input.fFinanceType ?? D.fFinanceType },
    { name: "p_fFinanceCharge", type: sql.TinyInt, value: input.fFinanceCharge ?? D.fFinanceCharge },
    { name: "p_fTaxExempt", type: sql.TinyInt, value: input.fTaxExempt ?? D.fTaxExempt },
    { name: "p_fSetCredLimit", type: sql.TinyInt, value: fSetCredLimit },
    { name: "p_fPageBreak", type: sql.TinyInt, value: input.fPageBreak ?? D.fPageBreak },
    { name: "p_TenderCode", type: sql.Int, value: input.tenderCode ?? D.TenderCode },
    { name: "p_DiscountType", type: sql.Int, value: input.discountType ?? D.DiscountType },
    { name: "p_PrintInvoice", type: sql.Int, value: input.printInvoice ?? D.PrintInvoice },
    { name: "p_fPermitChgDue", type: sql.TinyInt, value: input.fPermitChgDue ?? D.fPermitChgDue },
    { name: "p_fOpenDrawer", type: sql.TinyInt, value: input.fOpenDrawer ?? D.fOpenDrawer },
    { name: "p_fRefRequired", type: sql.TinyInt, value: input.fRefRequired ?? D.fRefRequired },
    { name: "p_fAccessibleOnline", type: sql.TinyInt, value: input.fAccessibleOnline ?? 0 },
    { name: "p_fAllowLimitChg", type: sql.TinyInt, value: input.fAllowLimitChg ?? D.fAllowLimitChg },
    { name: "p_HalfReceiptTemplateID", type: sql.Int, value: input.halfReceiptTemplateId ?? D.HalfReceiptTemplateID },
    { name: "p_FullReceiptTemplateID", type: sql.Int, value: input.fullReceiptTemplateId ?? D.FullReceiptTemplateID },
    { name: "p_fInvoiceInAR", type: sql.TinyInt, value: input.fInvoiceInAR ?? D.fInvoiceInAR },
    { name: "p_NonMerchOptID", type: sql.Int, value: input.nonMerchOptId ?? D.NonMerchOptID },
    { name: "p_fPrintBalance", type: sql.TinyInt, value: input.fPrintBalance ?? D.fPrintBalance },
    { name: "p_fDispCustCmnt", type: sql.TinyInt, value: input.fDispCustCmnt ?? D.fDispCustCmnt },
    { name: "p_fPrtCustCmnt", type: sql.TinyInt, value: input.fPrtCustCmnt ?? D.fPrtCustCmnt },
    { name: "p_PrtStartExpDate", type: sql.TinyInt, value: input.prtStartExpDate ?? D.PrtStartExpDate },
    { name: "p_TextbookValidation", type: sql.Int, value: input.textbookValidation ?? D.TextbookValidation },
    { name: "p_ValidateTextbooksOnly", type: sql.TinyInt, value: input.validateTextbooksOnly ?? D.ValidateTextbooksOnly },
  ];

  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const insertRequest = transaction.request();
    for (const p of params) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertRequest.input(p.name, p.type as any, p.value);
    }
    const insertResult = await insertRequest.query<{ newAgencyId: number }>(
      buildCreateAgencySql(),
    );

    const newAgencyId = Number(insertResult.recordset[0]?.newAgencyId);
    if (!Number.isFinite(newAgencyId) || newAgencyId <= 0) {
      throw new Error("Acct_Agency INSERT did not return a valid SCOPE_IDENTITY");
    }

    // Push to register-local POS DBs. Required after every create.
    await transaction
      .request()
      .input("AgencyID", sql.Int, newAgencyId)
      .execute("SP_ARAcctResendToPos");

    await transaction.commit();

    return {
      newAgencyId,
      newAgencyNumber,
      newName,
    };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      /* swallow */
    }
    throw err;
  }
}
