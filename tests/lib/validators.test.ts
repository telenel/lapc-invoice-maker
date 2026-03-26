import { describe, it, expect } from "vitest";
import {
  staffSchema,
  invoiceItemSchema,
  invoiceCreateSchema,
  invoiceUpdateSchema,
  quickPickSchema,
  savedLineItemSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  staffAccountNumberSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
} from "@/lib/validators";

// ---------------------------------------------------------------------------
// staffSchema
// ---------------------------------------------------------------------------
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

  it("accepts minimal input — name, title, department only", () => {
    const result = staffSchema.safeParse({
      name: "Alice Nguyen",
      title: "Instructor",
      department: "English",
    });
    expect(result.success).toBe(true);
  });

  it("defaults accountCode to empty string when omitted", () => {
    const result = staffSchema.safeParse({
      name: "Alice Nguyen",
      title: "Instructor",
      department: "English",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountCode).toBe("");
    }
  });

  it("defaults extension to empty string when omitted", () => {
    const result = staffSchema.safeParse({
      name: "Alice Nguyen",
      title: "Instructor",
      department: "English",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extension).toBe("");
    }
  });

  it("defaults email, phone, and approvalChain when omitted", () => {
    const result = staffSchema.safeParse({
      name: "Alice Nguyen",
      title: "Instructor",
      department: "English",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("");
      expect(result.data.phone).toBe("");
      expect(result.data.approvalChain).toEqual([]);
    }
  });

  it("rejects empty name", () => {
    const result = staffSchema.safeParse({
      name: "",
      title: "Instructor",
      department: "English",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = staffSchema.safeParse({
      name: "Alice Nguyen",
      title: "",
      department: "English",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty department", () => {
    const result = staffSchema.safeParse({
      name: "Alice Nguyen",
      title: "Instructor",
      department: "",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// invoiceItemSchema
// ---------------------------------------------------------------------------
describe("invoiceItemSchema", () => {
  it("accepts a valid item", () => {
    const result = invoiceItemSchema.safeParse({
      description: "Notebook",
      quantity: 3,
      unitPrice: 4.99,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty description", () => {
    const result = invoiceItemSchema.safeParse({
      description: "",
      quantity: 1,
      unitPrice: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero quantity", () => {
    const result = invoiceItemSchema.safeParse({
      description: "Pen",
      quantity: 0,
      unitPrice: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = invoiceItemSchema.safeParse({
      description: "Pen",
      quantity: -2,
      unitPrice: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero unitPrice (free items)", () => {
    const result = invoiceItemSchema.safeParse({
      description: "Complimentary brochure",
      quantity: 1,
      unitPrice: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative unitPrice", () => {
    const result = invoiceItemSchema.safeParse({
      description: "Discount",
      quantity: 1,
      unitPrice: -5,
    });
    expect(result.success).toBe(false);
  });

  it("defaults sortOrder to 0 when omitted", () => {
    const result = invoiceItemSchema.safeParse({
      description: "Notebook",
      quantity: 1,
      unitPrice: 2.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// invoiceCreateSchema
// ---------------------------------------------------------------------------

const validInvoiceBase = {
  invoiceNumber: "AG-000111222",
  date: "2026-03-25",
  staffId: "some-uuid",
  department: "Student Services",
  category: "SUPPLIES",
  items: [{ description: "Books", quantity: 2, unitPrice: 25.5 }],
};

describe("invoiceCreateSchema", () => {
  it("validates a complete invoice", () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoiceBase,
      accountCode: "1234",
      approvalChain: [],
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invoice with no items", () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoiceBase,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty invoice number (defaults for quote-converted invoices)", () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoiceBase,
      invoiceNumber: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing category", () => {
    const { category: _omit, ...withoutCategory } = validInvoiceBase;
    const result = invoiceCreateSchema.safeParse(withoutCategory);
    expect(result.success).toBe(false);
  });

  it("rejects missing staffId", () => {
    const { staffId: _omit, ...withoutStaffId } = validInvoiceBase;
    const result = invoiceCreateSchema.safeParse(withoutStaffId);
    expect(result.success).toBe(false);
  });

  it("rejects missing date", () => {
    const { date: _omit, ...withoutDate } = validInvoiceBase;
    const result = invoiceCreateSchema.safeParse(withoutDate);
    expect(result.success).toBe(false);
  });

  it("accepts with all optional fields provided", () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoiceBase,
      notes: "Please expedite",
      approvalChain: ["manager-uuid"],
      accountNumber: "ACC-9988",
      isRecurring: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts with recurring fields (isRecurring: true, recurringInterval, recurringEmail)", () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoiceBase,
      isRecurring: true,
      recurringInterval: "monthly",
      recurringEmail: "billing@piercecollege.edu",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRecurring).toBe(true);
      expect(result.data.recurringInterval).toBe("monthly");
      expect(result.data.recurringEmail).toBe("billing@piercecollege.edu");
    }
  });

  it("rejects an invalid recurringEmail", () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoiceBase,
      isRecurring: true,
      recurringEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for recurringEmail", () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoiceBase,
      recurringEmail: "",
    });
    expect(result.success).toBe(true);
  });

  it("defaults isRecurring to false when omitted", () => {
    const result = invoiceCreateSchema.safeParse(validInvoiceBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRecurring).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// invoiceUpdateSchema
// ---------------------------------------------------------------------------
describe("invoiceUpdateSchema", () => {
  it("accepts a partial update with just notes", () => {
    const result = invoiceUpdateSchema.safeParse({ notes: "Updated notes" });
    expect(result.success).toBe(true);
  });

  it("accepts an update that includes items", () => {
    const result = invoiceUpdateSchema.safeParse({
      notes: "Revised",
      items: [{ description: "Eraser", quantity: 5, unitPrice: 0.5 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an update with an empty items array", () => {
    const result = invoiceUpdateSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("accepts an empty object (fully partial)", () => {
    const result = invoiceUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// quickPickSchema
// ---------------------------------------------------------------------------
describe("quickPickSchema", () => {
  it("validates a quick pick item", () => {
    const result = quickPickSchema.safeParse({
      department: "Student Services",
      description: "Notebook",
      defaultPrice: 5.99,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative defaultPrice", () => {
    const result = quickPickSchema.safeParse({
      department: "Student Services",
      description: "Notebook",
      defaultPrice: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero defaultPrice", () => {
    const result = quickPickSchema.safeParse({
      department: "Student Services",
      description: "Free item",
      defaultPrice: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty department", () => {
    const result = quickPickSchema.safeParse({
      department: "",
      description: "Notebook",
      defaultPrice: 5.99,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = quickPickSchema.safeParse({
      department: "Math",
      description: "",
      defaultPrice: 5.99,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// savedLineItemSchema
// ---------------------------------------------------------------------------
describe("savedLineItemSchema", () => {
  it("accepts a valid saved line item", () => {
    const result = savedLineItemSchema.safeParse({
      department: "English",
      description: "Textbook",
      unitPrice: 49.99,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty department", () => {
    const result = savedLineItemSchema.safeParse({
      department: "",
      description: "Textbook",
      unitPrice: 49.99,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = savedLineItemSchema.safeParse({
      department: "English",
      description: "",
      unitPrice: 49.99,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero unitPrice", () => {
    const result = savedLineItemSchema.safeParse({
      department: "English",
      description: "Free handout",
      unitPrice: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative unitPrice", () => {
    const result = savedLineItemSchema.safeParse({
      department: "English",
      description: "Textbook",
      unitPrice: -10,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// categoryCreateSchema
// ---------------------------------------------------------------------------
describe("categoryCreateSchema", () => {
  it("accepts valid category", () => {
    const result = categoryCreateSchema.safeParse({ name: "SUPPLIES", label: "Supplies" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = categoryCreateSchema.safeParse({ name: "", label: "Supplies" });
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = categoryCreateSchema.safeParse({ name: "SUPPLIES", label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = categoryCreateSchema.safeParse({ label: "Supplies" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// categoryUpdateSchema
// ---------------------------------------------------------------------------
describe("categoryUpdateSchema", () => {
  it("accepts partial update with just name", () => {
    const result = categoryUpdateSchema.safeParse({ name: "NEW_NAME" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = categoryUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts sortOrder as integer", () => {
    const result = categoryUpdateSchema.safeParse({ sortOrder: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects sortOrder as float", () => {
    const result = categoryUpdateSchema.safeParse({ sortOrder: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts active boolean", () => {
    const result = categoryUpdateSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// staffAccountNumberSchema
// ---------------------------------------------------------------------------
describe("staffAccountNumberSchema", () => {
  it("accepts valid account number", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "ACC-001" });
    expect(result.success).toBe(true);
  });

  it("accepts with description", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "ACC-001", description: "Main account" });
    expect(result.success).toBe(true);
  });

  it("rejects empty accountCode", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "" });
    expect(result.success).toBe(false);
  });

  it("defaults description to empty string", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "ACC-001" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// adminUserCreateSchema
// ---------------------------------------------------------------------------
describe("adminUserCreateSchema", () => {
  it("accepts valid user with name only", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John Doe" });
    expect(result.success).toBe(true);
  });

  it("accepts with valid email", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John", email: "john@example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts empty string email", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John", email: "" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John", email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = adminUserCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adminUserUpdateSchema
// ---------------------------------------------------------------------------
describe("adminUserUpdateSchema", () => {
  it("accepts empty object", () => {
    const result = adminUserUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid role", () => {
    const result = adminUserUpdateSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = adminUserUpdateSchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
  });
});
