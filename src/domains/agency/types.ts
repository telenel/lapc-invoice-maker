/**
 * Agency-domain types — modeling Prism's Acct_Agency rows + Pierce semester
 * naming conventions for the laportal rollover feature.
 *
 * Authoritative reference: docs/prism/static/actions/clone-ar-agency.md +
 * docs/prism/static/actions/agency-binary-findings.md
 */

/**
 * Pierce semester prefix: P + (SP|FA|SU|WI) + YY.
 * Matches AgencyNumber values like PSP26, PWI25, PSU24, PFA23.
 */
export type PierceSemester = `P${"SP" | "FA" | "SU" | "WI"}${number}`;

export const PIERCE_SEMESTER_REGEX = /^P(SP|FA|SU|WI)\d{2}$/;

/**
 * The minimal Acct_Agency row laportal reads back when listing/previewing.
 * Mirrors the columns we need — not the full 53.
 */
export interface AgencyRecord {
  agencyId: number;
  agencyNumber: string;
  name: string;
  agencyTypeId: number;
  creditLimit: number;
  tenderCode: number;
  fStatus: number;
  fAccessibleOnline: number;
  fSetCredLimit: number;
}

/**
 * One agency that would be cloned in a roll-semester operation.
 */
export interface RollPlanRow {
  source: AgencyRecord;
  targetAgencyNumber: string;
  targetName: string;
  /** True if the target AgencyNumber already exists in Acct_Agency. */
  alreadyExists: boolean;
}

/**
 * The full plan returned by previewRollSemester. The client renders this and
 * hands it back (with a selection of which rows to roll) to the execute call.
 */
export interface RollSemesterPlan {
  sourceSemester: string;
  targetSemester: string;
  /** All source agencies found, in alpha order. */
  rows: RollPlanRow[];
}

/**
 * The result of an executed rollover. Returned to the client + recorded in
 * the laportal-side audit log.
 */
export interface RollSemesterResult {
  sourceSemester: string;
  targetSemester: string;
  /** Rows that were created. */
  created: Array<{
    sourceAgencyId: number;
    sourceAgencyNumber: string;
    newAgencyId: number;
    newAgencyNumber: string;
  }>;
  /** Rows skipped because the target already existed (or user deselected). */
  skipped: Array<{
    sourceAgencyNumber: string;
    targetAgencyNumber: string;
    reason: "already_exists" | "deselected";
  }>;
}

export interface CloneAgencyInput {
  sourceAgencyId: number;
  newAgencyNumber: string;
  newName: string;
}

export interface CloneAgencyResult {
  newAgencyId: number;
  newAgencyNumber: string;
  newName: string;
}
