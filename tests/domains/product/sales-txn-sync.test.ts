import { describe, expect, it, vi } from "vitest";
import { runSalesTxnSync } from "@/domains/product/sales-txn-sync";

function makeMockSupabase(state: { last_transaction_id: number; backfill_completed_at: string | null }) {
  const upserted: unknown[][] = [];
  const stateUpdates: unknown[] = [];

  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: state, error: null }),
        }),
        // For the post-insert count (.select(...).select('*', { count: 'exact', head: true })):
        // some calls use head:true which returns a different chain — handle both
        ...({ count: 0 } as unknown as object),
      }),
      upsert: async (rows: unknown[]) => { upserted.push(rows); return { error: null }; },
      update: (patch: unknown) => ({
        eq: async () => { stateUpdates.push({ table, patch }); return { error: null }; },
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: 42, error: null }),
  };

  return { client, upserted, stateUpdates };
}

function makeMockPrism(rows: Array<Record<string, unknown>>) {
  return {
    request: () => {
      const chain: Record<string, unknown> = {
        input: () => chain,
        query: async () => ({ recordset: rows }),
      };
      return chain;
    },
  };
}

describe("runSalesTxnSync", () => {
  it("returns zero and flags skipped when backfill hasn't completed", async () => {
    const { client } = makeMockSupabase({ last_transaction_id: 0, backfill_completed_at: null });
    const prism = makeMockPrism([]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.txnsAdded).toBe(0);
    expect(result.aggregatesUpdated).toBe(0);
    expect(result.skipped).toBe("backfill-not-completed");
  });

  it("advances the cursor to the max TransactionID of inserted rows", async () => {
    const { client, stateUpdates } = makeMockSupabase({
      last_transaction_id: 100,
      backfill_completed_at: new Date().toISOString(),
    });
    const prism = makeMockPrism([
      { TranDtlID: 5, TransactionID: 101, SKU: 99, LocationID: 2, ProcessDate: new Date() },
      { TranDtlID: 6, TransactionID: 105, SKU: 99, LocationID: 2, ProcessDate: new Date() },
      { TranDtlID: 7, TransactionID: 103, SKU: 99, LocationID: 2, ProcessDate: new Date() },
    ]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.txnsAdded).toBe(3);
    // Find the cursor-advancing update — it includes last_transaction_id in its patch.
    const cursorUpdate = stateUpdates.find(
      (u) => typeof (u as { patch: { last_transaction_id?: number } }).patch.last_transaction_id === "number",
    ) as { patch: { last_transaction_id: number } };
    expect(cursorUpdate.patch.last_transaction_id).toBe(105);
  });

  it("triggers aggregate recompute when any rows were added", async () => {
    const { client } = makeMockSupabase({
      last_transaction_id: 100,
      backfill_completed_at: new Date().toISOString(),
    });
    const prism = makeMockPrism([
      { TranDtlID: 5, TransactionID: 200, SKU: 99, LocationID: 2, ProcessDate: new Date() },
    ]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.aggregatesUpdated).toBe(42);
    expect(client.rpc).toHaveBeenCalledWith("recompute_product_sales_aggregates");
  });

  it("skips aggregate recompute when zero rows added", async () => {
    const { client } = makeMockSupabase({
      last_transaction_id: 100,
      backfill_completed_at: new Date().toISOString(),
    });
    const prism = makeMockPrism([]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.txnsAdded).toBe(0);
    expect(result.aggregatesUpdated).toBe(0);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
