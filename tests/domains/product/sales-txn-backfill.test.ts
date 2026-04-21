import { describe, expect, it, vi } from "vitest";
import { runSalesTxnBackfill } from "@/domains/product/sales-txn-backfill";

function makeMockSupabase(state: { last_transaction_id: number; backfill_completed_at: string | null }) {
  const upserted: unknown[][] = [];
  const stateUpdates: Array<{ table: string; patch: Record<string, unknown> }> = [];

  const client = {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        if (table === "sales_transactions_sync_state") {
          return {
            eq: () => ({
              single: async () => ({ data: state, error: null }),
            }),
          };
        }

        if (table === "sales_transactions" && args[1] && typeof args[1] === "object") {
          return Promise.resolve({ count: upserted.flat().length, error: null });
        }

        throw new Error(`Unexpected select on ${table}`);
      },
      upsert: async (rows: unknown[]) => {
        upserted.push(rows);
        return { error: null };
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          stateUpdates.push({ table, patch });
          return { error: null };
        },
      }),
    }),
  };

  return { client, upserted, stateUpdates };
}

function makeMockPrism(pages: Array<Array<Record<string, unknown>>>) {
  const queryResults = [
    { recordset: [{ ExpectedRows: pages.flat().length }] },
    ...pages.map((recordset) => ({ recordset })),
  ];

  return {
    request: () => {
      const chain: Record<string, unknown> = {
        input: () => chain,
        query: async () => {
          const next = queryResults.shift();
          if (!next) throw new Error("Unexpected extra query");
          return next;
        },
      };
      return chain;
    },
  };
}

function makePrismRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    TranDtlID: 5,
    TransactionID: 101,
    SKU: 99,
    TranTypeID: 1,
    LocationID: 2,
    UserID: 3,
    POSID: 4,
    RegisterID: 5,
    ReceiptID: 6,
    TranNumber: "ABC123   ",
    PosLineNumber: 1,
    Qty: 2,
    Price: 10,
    ExtPrice: 20,
    DiscountAmt: 0,
    MarkDownAmt: 0,
    TaxAmt: 0,
    Description: "Widget",
    HdrFStatus: 0,
    DtlFStatus: 0,
    FInvoiced: 0,
    TranTotal: 20,
    TaxTotal: 0,
    ProcessDate: new Date("2026-04-20T12:00:00.000Z"),
    CreateDate: new Date("2026-04-20T12:00:00.000Z"),
    DtlCreateDate: new Date("2026-04-20T12:00:00.000Z"),
    ...overrides,
  };
}

describe("runSalesTxnBackfill", () => {
  it("does not mark the backfill complete when aggregate recompute fails", async () => {
    const { client, stateUpdates } = makeMockSupabase({
      last_transaction_id: 0,
      backfill_completed_at: null,
    });
    const prism = makeMockPrism([[makePrismRow()], []]);
    const recompute = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      runSalesTxnBackfill({
        supabase: client as never,
        prism: prism as never,
        recompute,
        log: vi.fn(),
        now: () => new Date("2026-04-21T00:00:00.000Z"),
      }),
    ).rejects.toThrow(/boom/);

    expect(recompute).toHaveBeenCalledTimes(1);
    expect(stateUpdates).toContainEqual({
      table: "sales_transactions_sync_state",
      patch: {
        last_transaction_id: 101,
        last_process_date: "2026-04-20T12:00:00.000Z",
        total_rows: 1,
      },
    });
    expect(
      stateUpdates.some(({ patch }) => Object.prototype.hasOwnProperty.call(patch, "backfill_completed_at")),
    ).toBe(false);
  });

  it("marks the backfill complete only after aggregate recompute succeeds", async () => {
    const { client, stateUpdates } = makeMockSupabase({
      last_transaction_id: 0,
      backfill_completed_at: null,
    });
    const prism = makeMockPrism([[makePrismRow()], []]);
    const recompute = vi.fn().mockResolvedValue(7);
    const completedAt = "2026-04-21T00:00:00.000Z";

    const result = await runSalesTxnBackfill({
      supabase: client as never,
      prism: prism as never,
      recompute,
      log: vi.fn(),
      now: () => new Date(completedAt),
    });

    expect(result.totalInserted).toBe(1);
    expect(result.aggregatesUpdated).toBe(7);
    expect(stateUpdates).toEqual([
      {
        table: "sales_transactions_sync_state",
        patch: {
          last_transaction_id: 101,
          last_process_date: "2026-04-20T12:00:00.000Z",
          total_rows: 1,
        },
      },
      {
        table: "sales_transactions_sync_state",
        patch: {
          backfill_completed_at: completedAt,
        },
      },
    ]);
  });
});
