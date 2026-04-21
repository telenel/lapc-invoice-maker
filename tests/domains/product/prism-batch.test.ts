import { beforeEach, describe, expect, it, vi } from "vitest";

const prismLibMocks = vi.hoisted(() => ({
  getPrismPool: vi.fn(),
  sql: {
    Int: "Int",
    VarChar: () => "VarChar",
    Money: "Money",
    Decimal: () => "Decimal",
    Bit: "Bit",
    TinyInt: "TinyInt",
    SmallInt: "SmallInt",
    DateTime: "DateTime",
    Numeric: () => "Numeric",
  },
}));

vi.mock("@/lib/prism", () => prismLibMocks);

/**
 * Minimal mssql-shaped fake: one Transaction object whose `request()`
 * returns chainable Request fakes that record every executed query.
 */
function makeFakePool(options: {
  /** Called per executed query. Return the recordset to emit. */
  onQuery: (sql: string) => unknown[];
  /** Mutated so tests can assert lifecycle. */
  lifecycle: { began: number; committed: number; rolledBack: number };
  /** Every SQL string issued against the transaction, in order. Lets tests
   *  assert that row-N's UPDATE was attempted inside the transaction before
   *  a later row rolled everything back — i.e. the rollback actually did
   *  work, it didn't just short-circuit before any UPDATE ran. */
  sqlLog?: string[];
}) {
  const { onQuery, lifecycle, sqlLog } = options;
  const makeRequest = () => {
    const req = {
      input: vi.fn().mockImplementation(() => req),
      query: vi.fn().mockImplementation(async (sqlText: string) => {
        sqlLog?.push(sqlText);
        return { recordset: onQuery(sqlText) };
      }),
      execute: vi.fn().mockResolvedValue({ recordsets: [[]] }),
    };
    return req;
  };
  const transaction = {
    begin: vi.fn().mockImplementation(async () => { lifecycle.began += 1; }),
    commit: vi.fn().mockImplementation(async () => { lifecycle.committed += 1; }),
    rollback: vi.fn().mockImplementation(async () => { lifecycle.rolledBack += 1; }),
    request: vi.fn().mockImplementation(makeRequest),
  };
  return { transaction: vi.fn().mockReturnValue(transaction), request: vi.fn().mockImplementation(makeRequest) };
}

describe("batchUpdateItems", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rolls back every row when the second row's baseline mismatches", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };
    const sqlLog: string[] = [];

    // Row 1's SELECT returns matching state; row 2's returns a different retail.
    let selectCount = 0;
    const pool = makeFakePool({
      lifecycle,
      sqlLog,
      onQuery: (sqlText) => {
        if (!sqlText.includes("SELECT")) return [];
        selectCount += 1;
        if (selectCount === 1) {
          return [{ BarCode: "AAA", ItemTaxTypeID: 6, Retail: 10, Cost: 5, fDiscontinue: 0 }];
        }
        return [{ BarCode: "BBB", ItemTaxTypeID: 6, Retail: 999, Cost: 5, fDiscontinue: 0 }];
      },
    });

    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    const rows = [
      { sku: 101, isTextbook: false, patch: { retail: 11 }, baseline: { sku: 101, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
      { sku: 102, isTextbook: false, patch: { retail: 11 }, baseline: { sku: 102, barcode: "BBB", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
    ];

    await expect(batchUpdateItems(rows)).rejects.toMatchObject({
      code: "CONCURRENT_MODIFICATION",
      rowIndex: 1,
    });

    expect(lifecycle.began).toBe(1);
    expect(lifecycle.committed).toBe(0);
    expect(lifecycle.rolledBack).toBe(1);
    // Proves the invariant is delivered by rollback, not by short-circuit:
    // row 1's UPDATE was issued inside the transaction (so would have
    // persisted without rollback). Row 2's SELECT fires next, fails the
    // concurrency check, and the outer catch rolls row 1's write back.
    const row1UpdateIssued = sqlLog.some((q) => /UPDATE\s+Inventory/i.test(q));
    const row2SelectIssued = sqlLog.filter((q) => /SELECT/i.test(q)).length >= 2;
    expect(row1UpdateIssued).toBe(true);
    expect(row2SelectIssued).toBe(true);
  });

  it("commits once when all baselines match", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };
    const pool = makeFakePool({
      lifecycle,
      onQuery: (sqlText) => {
        if (!sqlText.includes("SELECT")) return [];
        return [{ BarCode: "AAA", ItemTaxTypeID: 6, Retail: 10, Cost: 5, fDiscontinue: 0 }];
      },
    });
    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    const rows = [
      { sku: 101, isTextbook: false, patch: { retail: 11 }, baseline: { sku: 101, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
      { sku: 102, isTextbook: true, patch: { retail: 12 }, baseline: { sku: 102, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
    ];

    await expect(batchUpdateItems(rows)).resolves.toEqual([101, 102]);
    expect(lifecycle.began).toBe(1);
    expect(lifecycle.committed).toBe(1);
    expect(lifecycle.rolledBack).toBe(0);
  });

  it("returns [] and opens no transaction for an empty row list", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };
    const pool = makeFakePool({ lifecycle, onQuery: () => [] });
    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    await expect(batchUpdateItems([])).resolves.toEqual([]);
    expect(lifecycle.began).toBe(0);
  });

  it("rolls back when row 3 raises a non-concurrency SQL error", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };
    let selectCount = 0;
    const pool = makeFakePool({
      lifecycle,
      onQuery: (sqlText) => {
        if (!sqlText.includes("SELECT")) {
          // row 3's UPDATE throws
          if (selectCount >= 3) throw new Error("FK violation");
          return [];
        }
        selectCount += 1;
        return [{ BarCode: "AAA", ItemTaxTypeID: 6, Retail: 10, Cost: 5, fDiscontinue: 0 }];
      },
    });
    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    const rows = [101, 102, 103].map((sku) => ({
      sku, isTextbook: false, patch: { retail: 11 },
      baseline: { sku, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const },
    }));

    await expect(batchUpdateItems(rows)).rejects.toMatchObject({ rowIndex: 2, sku: 103 });
    expect(lifecycle.rolledBack).toBe(1);
    expect(lifecycle.committed).toBe(0);
  });
});
