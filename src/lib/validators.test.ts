import { describe, it, expect } from "vitest";
import { invoiceCreateSchema, quoteCreateSchema } from "./validators";

describe("invoiceCreateSchema.pdfMetadata.internalNotes", () => {
  it("accepts a string", () => {
    const r = invoiceCreateSchema.safeParse({
      date: "2026-04-26", department: "BKST", category: "x",
      items: [{ description: "a", quantity: 1, unitPrice: 1 }],
      pdfMetadata: { internalNotes: "secret" },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pdfMetadata?.internalNotes).toBe("secret");
  });

  it("treats internalNotes as optional", () => {
    const r = invoiceCreateSchema.safeParse({
      date: "2026-04-26", department: "BKST", category: "x",
      items: [{ description: "a", quantity: 1, unitPrice: 1 }],
      pdfMetadata: {},
    });
    expect(r.success).toBe(true);
  });
});

describe("quoteCreateSchema.pdfMetadata.internalNotes", () => {
  it("accepts a string", () => {
    const r = quoteCreateSchema.safeParse({
      date: "2026-04-26", department: "BKST", category: "x",
      items: [{ description: "a", quantity: 1, unitPrice: 1 }],
      expirationDate: "2026-05-26", recipientName: "Test",
      pdfMetadata: { internalNotes: "x" },
    });
    expect(r.success).toBe(true);
  });
});
