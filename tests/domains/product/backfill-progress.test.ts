import { describe, expect, it } from "vitest";
import { getBackfillPageProgress } from "@/domains/product/backfill-progress";

describe("getBackfillPageProgress", () => {
  it("tracks the max TransactionID across a TranDtlID-ordered page", () => {
    const now = new Date("2026-04-18T12:00:00.000Z");
    const progress = getBackfillPageProgress([
      { TranDtlID: 1001, TransactionID: 5001, ProcessDate: now },
      { TranDtlID: 1002, TransactionID: 5009, ProcessDate: new Date("2026-04-18T13:00:00.000Z") },
      { TranDtlID: 1003, TransactionID: 5003, ProcessDate: new Date("2026-04-18T14:00:00.000Z") },
    ], 4999);

    expect(progress.nextCursor).toBe(1003);
    expect(progress.maxTransactionId).toBe(5009);
    expect(progress.maxProcessDate?.toISOString()).toBe("2026-04-18T14:00:00.000Z");
  });
});
