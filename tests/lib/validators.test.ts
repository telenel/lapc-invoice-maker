import { describe, it, expect } from "vitest";
import {
  staffSchema,
  invoiceCreateSchema,
  quickPickSchema,
} from "@/lib/validators";

describe("staffSchema", () => {
  it("validates a complete staff record", () => {
    const result = staffSchema.safeParse({
      name: "Jason Cifra",
      title: "Vice President",
      department: "Student Services",
      accountCode: "1234",
      extension: "x2911",
      email: "cifraj@piercecollege.edu",
      phone: "818-555-1234",
      approvalChain: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = staffSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("invoiceCreateSchema", () => {
  it("validates a complete invoice", () => {
    const result = invoiceCreateSchema.safeParse({
      invoiceNumber: "AG-000111222",
      date: "2026-03-25",
      staffId: "some-uuid",
      department: "Student Services",
      accountCode: "1234",
      category: "SUPPLIES",
      approvalChain: [],
      notes: "",
      items: [
        {
          description: "Books",
          quantity: 2,
          unitPrice: 25.5,
          sortOrder: 0,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invoice with no items", () => {
    const result = invoiceCreateSchema.safeParse({
      invoiceNumber: "AG-000111222",
      date: "2026-03-25",
      staffId: "some-uuid",
      department: "Student Services",
      accountCode: "1234",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty invoice number", () => {
    const result = invoiceCreateSchema.safeParse({
      invoiceNumber: "",
      date: "2026-03-25",
      staffId: "some-uuid",
      department: "Student Services",
      accountCode: "1234",
      items: [{ description: "Test", quantity: 1, unitPrice: 10, sortOrder: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("quickPickSchema", () => {
  it("validates a quick pick item", () => {
    const result = quickPickSchema.safeParse({
      department: "Student Services",
      description: "Notebook",
      defaultPrice: 5.99,
    });
    expect(result.success).toBe(true);
  });
});
