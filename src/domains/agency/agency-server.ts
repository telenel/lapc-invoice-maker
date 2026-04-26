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
  buildExistingAgencyNumbersSql,
  buildListBySemesterSql,
  buildPierceSemestersSql,
  computeTargetAgencyNumber,
  computeTargetName,
} from "./sql";
import {
  validateCloneAgencyRequest,
  validateRollSemesterRequest,
} from "./validation";
import type {
  AgencyRecord,
  CloneAgencyInput,
  CloneAgencyResult,
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
