import { describe, it, expect } from "vitest";
import { renderCoverSheet } from "./cover-sheet";

describe("cover-sheet", () => {
  it("does not contain internal notes content", () => {
    const html = renderCoverSheet({
      date: "April 26, 2026",
      semesterYearDept: "SP26-BKST",
      invoiceNumber: "INV-1234",
      chargeAccountNumber: "10-4500-301",
      accountCode: "ABC",
      totalAmount: "$1,000",
      signatures: [{ name: "Jane" }],
    });
    expect(html).not.toMatch(/internalNotes/);
  });
});
