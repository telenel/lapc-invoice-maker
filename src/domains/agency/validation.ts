/**
 * Pure validators for the agency domain.
 *
 * These mirror WPAdmin's UI-level rules recovered from binary scans:
 *   - "Account Code is required."         → AgencyNumber non-empty
 *   - "Account Name is required."         → Name non-empty
 *   - char(26) on AgencyNumber            → max 26 chars
 *   - varchar(80) on Name                 → max 80 chars
 *
 * Pre-save duplicate-check (`SELECT COUNT(*) FROM Acct_Agency WHERE AgencyNumber = ...`)
 * lives in agency-server because it needs DB access.
 */
import { PIERCE_SEMESTER_REGEX } from "./types";

export interface ValidationFailure {
  field: string;
  message: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationFailure[] };

export const ACCT_AGENCY_NUMBER_MAX = 26;
export const ACCT_AGENCY_NAME_MAX = 80;

/**
 * Validate the structural requirements for an AgencyNumber. Does NOT check
 * uniqueness — that's a DB lookup, handled in agency-server.
 */
export function validateAgencyNumber(agencyNumber: string): ValidationResult {
  const errors: ValidationFailure[] = [];
  const trimmed = agencyNumber.trim();
  if (trimmed.length === 0) {
    errors.push({ field: "agencyNumber", message: "Account Code is required." });
  } else if (trimmed.length > ACCT_AGENCY_NUMBER_MAX) {
    errors.push({
      field: "agencyNumber",
      message: `Account Code must be at most ${ACCT_AGENCY_NUMBER_MAX} characters (got ${trimmed.length}).`,
    });
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateAgencyName(name: string): ValidationResult {
  const errors: ValidationFailure[] = [];
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    errors.push({ field: "name", message: "Account Name is required." });
  } else if (trimmed.length > ACCT_AGENCY_NAME_MAX) {
    errors.push({
      field: "name",
      message: `Account Name must be at most ${ACCT_AGENCY_NAME_MAX} characters (got ${trimmed.length}).`,
    });
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Validate that a string matches the Pierce semester pattern: P + season +
 * 2-digit year.
 */
export function validateSemester(semester: string): ValidationResult {
  const trimmed = semester.trim();
  if (!PIERCE_SEMESTER_REGEX.test(trimmed)) {
    return {
      ok: false,
      errors: [
        {
          field: "semester",
          message:
            "Semester must match P + (SP|FA|SU|WI) + 2-digit year, e.g. PWI26.",
        },
      ],
    };
  }
  return { ok: true };
}

export interface RollSemesterRequest {
  sourceSemester: string;
  targetSemester: string;
}

export function validateRollSemesterRequest(
  req: RollSemesterRequest,
): ValidationResult {
  const errors: ValidationFailure[] = [];

  const src = validateSemester(req.sourceSemester);
  if (!src.ok) {
    errors.push(...src.errors.map((e) => ({ ...e, field: "sourceSemester" })));
  }

  const tgt = validateSemester(req.targetSemester);
  if (!tgt.ok) {
    errors.push(...tgt.errors.map((e) => ({ ...e, field: "targetSemester" })));
  }

  if (errors.length === 0) {
    if (req.sourceSemester.trim() === req.targetSemester.trim()) {
      errors.push({
        field: "targetSemester",
        message: "Source and target semesters must differ.",
      });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export interface CloneAgencyRequest {
  sourceAgencyId: number;
  newAgencyNumber: string;
  newName: string;
}

export function validateCloneAgencyRequest(
  req: CloneAgencyRequest,
): ValidationResult {
  const errors: ValidationFailure[] = [];

  if (!Number.isInteger(req.sourceAgencyId) || req.sourceAgencyId <= 0) {
    errors.push({
      field: "sourceAgencyId",
      message: "Source AgencyID must be a positive integer.",
    });
  }

  const numCheck = validateAgencyNumber(req.newAgencyNumber);
  if (!numCheck.ok) {
    errors.push(...numCheck.errors.map((e) => ({ ...e, field: "newAgencyNumber" })));
  }

  const nameCheck = validateAgencyName(req.newName);
  if (!nameCheck.ok) {
    errors.push(...nameCheck.errors.map((e) => ({ ...e, field: "newName" })));
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
