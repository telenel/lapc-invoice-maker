import { describe, expect, it } from "vitest";
import {
  ACCT_AGENCY_INSERT_COLUMNS,
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

describe("ACCT_AGENCY_INSERT_COLUMNS", () => {
  it("contains exactly the 52 non-IDENTITY MFC-bound columns from WPData.dll", () => {
    // CARAgencySet binds 53 columns total. 52 are written; AgencyID is
    // the IDENTITY/PK and is not in the INSERT list.
    expect(ACCT_AGENCY_INSERT_COLUMNS).toHaveLength(52);
  });

  it("starts with AgencyNumber, Name, AgencyTypeID in MFC order", () => {
    expect(ACCT_AGENCY_INSERT_COLUMNS[0]).toBe("AgencyNumber");
    expect(ACCT_AGENCY_INSERT_COLUMNS[1]).toBe("Name");
    expect(ACCT_AGENCY_INSERT_COLUMNS[2]).toBe("AgencyTypeID");
  });

  it("preserves the schema typo MimimumCharge (not MinimumCharge)", () => {
    expect(ACCT_AGENCY_INSERT_COLUMNS).toContain("MimimumCharge");
    expect(ACCT_AGENCY_INSERT_COLUMNS).not.toContain("MinimumCharge");
  });

  it("does NOT include AgencyID (IDENTITY)", () => {
    expect(ACCT_AGENCY_INSERT_COLUMNS).not.toContain("AgencyID");
  });

  it("does NOT include txComment (omitted from comprehensive WPData.dll binding)", () => {
    expect(ACCT_AGENCY_INSERT_COLUMNS).not.toContain("txComment");
  });

  it("does NOT include fStatus (system column, not MFC-bound)", () => {
    expect(ACCT_AGENCY_INSERT_COLUMNS).not.toContain("fStatus");
  });

  it("includes the AR-billable switch fInvoiceInAR", () => {
    expect(ACCT_AGENCY_INSERT_COLUMNS).toContain("fInvoiceInAR");
  });

  it("includes the receipt-template columns the older WA_AR.dll binding lacks", () => {
    expect(ACCT_AGENCY_INSERT_COLUMNS).toContain("HalfReceiptTemplateID");
    expect(ACCT_AGENCY_INSERT_COLUMNS).toContain("FullReceiptTemplateID");
  });
});

describe("buildCloneAgencySql", () => {
  const sql = buildCloneAgencySql();

  it("references the source via @sourceAgencyId only (no string interpolation of inputs)", () => {
    expect(sql).toContain("@sourceAgencyId");
  });

  it("substitutes @newAgencyNumber and @newName in the SELECT list", () => {
    expect(sql).toContain("@newAgencyNumber");
    expect(sql).toContain("@newName");
  });

  it("emits one SCOPE_IDENTITY result row labeled newAgencyId", () => {
    expect(sql).toContain("SCOPE_IDENTITY()");
    expect(sql).toContain("AS newAgencyId");
  });

  it("does NOT include AgencyID in the INSERT column list", () => {
    // Match a comma-or-paren bounded literal AgencyID
    const insertOnly = sql.split("SELECT")[0] ?? "";
    // Allow @sourceAgencyId and AgencyID column on the WHERE side; only check
    // the INSERT column list section.
    const insertCols = insertOnly.match(/INSERT INTO Acct_Agency \(([^)]*)\)/);
    expect(insertCols).not.toBeNull();
    const colsList = insertCols?.[1] ?? "";
    expect(colsList).not.toContain("AgencyID");
  });

  it("does NOT include txComment in the INSERT column list", () => {
    const insertCols = sql.match(/INSERT INTO Acct_Agency \(([^)]*)\)/);
    expect(insertCols?.[1]).not.toContain("txComment");
  });

  it("INSERT column list and SELECT expressions have the same arity", () => {
    const insertMatch = sql.match(/INSERT INTO Acct_Agency \(([^)]*)\)/);
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM Acct_Agency/s);
    expect(insertMatch).not.toBeNull();
    expect(selectMatch).not.toBeNull();
    const insertCount = insertMatch![1].split(",").length;
    const selectCount = selectMatch![1].split(",").length;
    expect(insertCount).toBe(selectCount);
    expect(insertCount).toBe(52);
  });

  it("uses parameterized binding (no concatenated user input)", () => {
    // No literal strings between quotes that look like dynamic data
    expect(sql).not.toMatch(/'[^']*\${/); // no template literal interpolation
    expect(sql).not.toMatch(/' \+ /); // no string concatenation
  });
});

describe("buildListBySemesterSql", () => {
  const sql = buildListBySemesterSql();

  it("filters by AgencyNumber LIKE @prefix + '%'", () => {
    expect(sql).toContain("AgencyNumber LIKE @prefix + '%'");
  });

  it("trims AgencyNumber and Name in the SELECT", () => {
    expect(sql).toContain("LTRIM(RTRIM(AgencyNumber))");
    expect(sql).toContain("LTRIM(RTRIM(Name))");
  });

  it("orders results by AgencyNumber for stable display", () => {
    expect(sql).toContain("ORDER BY AgencyNumber");
  });

  it("returns the expected fields for AgencyRecord", () => {
    for (const field of [
      "agencyId",
      "agencyNumber",
      "name",
      "agencyTypeId",
      "creditLimit",
      "tenderCode",
      "fStatus",
      "fAccessibleOnline",
      "fSetCredLimit",
    ]) {
      expect(sql).toContain(`AS ${field}`);
    }
  });
});

describe("buildExistingAgencyNumbersSql", () => {
  it("uses parameterized prefix matching", () => {
    const sql = buildExistingAgencyNumbersSql();
    expect(sql).toContain("@prefix + '%'");
    expect(sql).toContain("LTRIM(RTRIM(AgencyNumber))");
  });
});

describe("buildPierceSemestersSql", () => {
  const sql = buildPierceSemestersSql();

  it("filters to Pierce two-letter-season prefixes only", () => {
    expect(sql).toContain("'PSP%'");
    expect(sql).toContain("'PFA%'");
    expect(sql).toContain("'PSU%'");
    expect(sql).toContain("'PWI%'");
  });

  it("groups by 5-char prefix and orders newest-first", () => {
    expect(sql).toContain("LEFT(LTRIM(RTRIM(AgencyNumber)), 5)");
    expect(sql).toContain("ORDER BY prefix DESC");
  });
});

describe("computeTargetAgencyNumber", () => {
  it("swaps semester prefix for modern agency numbers", () => {
    expect(computeTargetAgencyNumber("PWI25EOPSDEPT", "PWI25", "PWI26")).toBe(
      "PWI26EOPSDEPT",
    );
    expect(computeTargetAgencyNumber("PSP25USVETS", "PSP25", "PSP26")).toBe(
      "PSP26USVETS",
    );
    expect(computeTargetAgencyNumber("PSU25EOPSMEALJUNE", "PSU25", "PSU26")).toBe(
      "PSU26EOPSMEALJUNE",
    );
  });

  it("trims surrounding whitespace from the source AgencyNumber", () => {
    expect(computeTargetAgencyNumber("  PWI25EOPSDEPT  ", "PWI25", "PWI26")).toBe(
      "PWI26EOPSDEPT",
    );
  });

  it("throws if the source does not start with the expected prefix", () => {
    expect(() =>
      computeTargetAgencyNumber("PSP25EOPSDEPT", "PWI25", "PWI26"),
    ).toThrow(/does not start with/);
  });
});

describe("computeTargetName", () => {
  it("swaps the agency number when Name === AgencyNumber (modern style)", () => {
    expect(computeTargetName("PWI25EOPSDEPT", "PWI25EOPSDEPT", "PWI26EOPSDEPT")).toBe(
      "PWI26EOPSDEPT",
    );
  });

  it("substitutes the year in verbose names when prefix YY changes", () => {
    expect(
      computeTargetName(
        "PIERCE WINTER 2023 EOPS DEPARTMENT",
        "PWI23EOPSDEPT",
        "PWI24EOPSDEPT",
      ),
    ).toBe("PIERCE WINTER 2024 EOPS DEPARTMENT");
  });

  it("returns the source Name unchanged when no year is found in the verbose name", () => {
    expect(
      computeTargetName("Cathy's Department", "PWI25EOPSDEPT", "PWI26EOPSDEPT"),
    ).toBe("Cathy's Department");
  });

  it("trims whitespace", () => {
    expect(computeTargetName("  PWI25EOPSDEPT  ", "PWI25EOPSDEPT", "PWI26EOPSDEPT")).toBe(
      "PWI26EOPSDEPT",
    );
  });
});

describe("buildCreateAgencySql", () => {
  const sql = buildCreateAgencySql();

  it("INSERTs into Acct_Agency with the 52 MFC-bound columns", () => {
    const insertMatch = sql.match(/INSERT INTO Acct_Agency \(([^)]*)\)/);
    expect(insertMatch).not.toBeNull();
    const cols = insertMatch![1].split(",").map((c) => c.trim());
    expect(cols).toHaveLength(52);
    expect(cols[0]).toBe("AgencyNumber");
    expect(cols[1]).toBe("Name");
    expect(cols[2]).toBe("AgencyTypeID");
    expect(cols).not.toContain("AgencyID");
    expect(cols).not.toContain("txComment");
  });

  it("uses parameterized values prefixed with @p_", () => {
    const valuesMatch = sql.match(/VALUES \(([^)]*)\)/);
    expect(valuesMatch).not.toBeNull();
    const values = valuesMatch![1].split(",").map((v) => v.trim());
    expect(values).toHaveLength(52);
    for (const v of values) {
      expect(v).toMatch(/^@p_[A-Za-z0-9]+$/);
    }
  });

  it("returns SCOPE_IDENTITY in a result row labeled newAgencyId", () => {
    expect(sql).toContain("SCOPE_IDENTITY()");
    expect(sql).toContain("AS newAgencyId");
  });

  it("does not contain any string-interpolation markers (no '${' or '+ ')", () => {
    expect(sql).not.toMatch(/\$\{/);
    // No ad-hoc string concatenation either
    expect(sql).not.toMatch(/'\s*\+\s*/);
  });
});

describe("buildSearchAgenciesSql", () => {
  const sql = buildSearchAgenciesSql();

  it("uses parameterized @q for the search term and @limit for the row cap", () => {
    expect(sql).toContain("@q");
    expect(sql).toContain("TOP (@limit)");
  });

  it("filters to Pierce naming convention", () => {
    expect(sql).toContain("'PSP%'");
    expect(sql).toContain("'PFA%'");
    expect(sql).toContain("'PSU%'");
    expect(sql).toContain("'PWI%'");
  });

  it("matches both AgencyNumber and Name", () => {
    expect(sql).toContain("AgencyNumber LIKE '%' + @q + '%'");
    expect(sql).toContain("Name LIKE '%' + @q + '%'");
  });

  it("orders by AgencyNumber DESC for newest-first", () => {
    expect(sql).toContain("ORDER BY AgencyNumber DESC");
  });
});

describe("buildGetAgencyByIdSql", () => {
  it("filters by @agencyId and returns AgencyRecord shape", () => {
    const sql = buildGetAgencyByIdSql();
    expect(sql).toContain("WHERE AgencyID = @agencyId");
    expect(sql).toContain("AS agencyId");
    expect(sql).toContain("AS agencyNumber");
    expect(sql).toContain("AS name");
  });
});
