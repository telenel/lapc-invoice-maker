import { describe, expect, it } from "vitest";
import {
  ACCT_AGENCY_NAME_MAX,
  ACCT_AGENCY_NUMBER_MAX,
  validateAgencyName,
  validateAgencyNumber,
  validateCloneAgencyRequest,
  validateCreateAgencyRequest,
  validateRollSemesterRequest,
  validateSemester,
} from "./validation";

describe("validateAgencyNumber", () => {
  it("accepts a typical Pierce code", () => {
    expect(validateAgencyNumber("PWI26EOPSDEPT")).toEqual({ ok: true });
  });

  it("rejects empty / whitespace-only", () => {
    const r = validateAgencyNumber("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/Account Code is required/);

    const r2 = validateAgencyNumber("   ");
    expect(r2.ok).toBe(false);
  });

  it(`rejects strings longer than ${ACCT_AGENCY_NUMBER_MAX} characters`, () => {
    const tooLong = "P" + "X".repeat(ACCT_AGENCY_NUMBER_MAX);
    const r = validateAgencyNumber(tooLong);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/at most 26/);
  });
});

describe("validateAgencyName", () => {
  it("accepts a typical name", () => {
    expect(validateAgencyName("PWI26EOPSDEPT")).toEqual({ ok: true });
  });

  it("rejects empty", () => {
    const r = validateAgencyName("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/Account Name is required/);
  });

  it(`rejects names longer than ${ACCT_AGENCY_NAME_MAX} characters`, () => {
    const r = validateAgencyName("X".repeat(ACCT_AGENCY_NAME_MAX + 1));
    expect(r.ok).toBe(false);
  });
});

describe("validateSemester", () => {
  it.each(["PSP26", "PFA25", "PSU24", "PWI26"])("accepts %s", (s) => {
    expect(validateSemester(s)).toEqual({ ok: true });
  });

  it.each([
    "PSP2026", // 4-digit year not allowed
    "PSP", // missing year
    "PWI", // missing year
    "PWi26", // lowercase season letter
    "psp26", // lowercase prefix
    "PWI226", // 3-digit year
    "WI26", // missing P prefix
    "PXX26", // invalid season letters
    "P26", // missing season
  ])("rejects %s", (s) => {
    expect(validateSemester(s).ok).toBe(false);
  });
});

describe("validateRollSemesterRequest", () => {
  it("accepts a valid pair", () => {
    expect(
      validateRollSemesterRequest({ sourceSemester: "PWI25", targetSemester: "PWI26" }),
    ).toEqual({ ok: true });
  });

  it("rejects when source equals target", () => {
    const r = validateRollSemesterRequest({
      sourceSemester: "PWI26",
      targetSemester: "PWI26",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/must differ/);
  });

  it("reports field-specific errors for each invalid semester", () => {
    const r = validateRollSemesterRequest({
      sourceSemester: "BAD",
      targetSemester: "ALSO_BAD",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const fields = r.errors.map((e) => e.field);
      expect(fields).toContain("sourceSemester");
      expect(fields).toContain("targetSemester");
    }
  });
});

describe("validateCloneAgencyRequest", () => {
  it("accepts a valid clone request", () => {
    expect(
      validateCloneAgencyRequest({
        sourceAgencyId: 12345,
        newAgencyNumber: "PWI26EOPSDEPT",
        newName: "PWI26EOPSDEPT",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects non-positive sourceAgencyId", () => {
    const r = validateCloneAgencyRequest({
      sourceAgencyId: 0,
      newAgencyNumber: "PWI26X",
      newName: "PWI26X",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty newAgencyNumber", () => {
    const r = validateCloneAgencyRequest({
      sourceAgencyId: 1,
      newAgencyNumber: "",
      newName: "X",
    });
    expect(r.ok).toBe(false);
  });

  it("collects multiple errors at once", () => {
    const r = validateCloneAgencyRequest({
      sourceAgencyId: -1,
      newAgencyNumber: "",
      newName: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("validateCreateAgencyRequest", () => {
  it("accepts a minimal valid request", () => {
    expect(
      validateCreateAgencyRequest({
        agencyNumber: "PSP26TEST",
        name: "PSP26TEST",
        agencyTypeId: 4,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects empty agencyNumber", () => {
    const r = validateCreateAgencyRequest({
      agencyNumber: "",
      name: "X",
      agencyTypeId: 4,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty name", () => {
    const r = validateCreateAgencyRequest({
      agencyNumber: "PSP26TEST",
      name: "",
      agencyTypeId: 4,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects non-positive agencyTypeId", () => {
    const r = validateCreateAgencyRequest({
      agencyNumber: "PSP26TEST",
      name: "PSP26TEST",
      agencyTypeId: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].message).toMatch(/AgencyTypeID is required/);
    }
  });

  it("collects all errors at once", () => {
    const r = validateCreateAgencyRequest({
      agencyNumber: "",
      name: "",
      agencyTypeId: -1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});
