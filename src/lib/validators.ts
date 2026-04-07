import { z } from "zod";

export const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().min(1, "Title is required"),
  department: z.string().min(1, "Department is required"),
  accountCode: z.string().default(""),
  extension: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  birthMonth: z.number().int().min(1).max(12).optional(),
  birthDay: z.number().int().min(1).max(31).optional(),
  approvalChain: z.array(z.string()).default([]),
});

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Price must be non-negative"),
  sortOrder: z.number().int().default(0),
  isTaxable: z.boolean().default(true),
  marginOverride: z.number().optional(),
  costPrice: z.number().optional(),
});

export const invoiceCreateSchema = z.object({
  invoiceNumber: z.string().nullable().default(""),
  date: z.string().min(1, "Date is required"),
  // staffId and contactId are both optional — service layer ensures at least one is set
  staffId: z.string().optional(),
  contactId: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  category: z.string().min(1, "Category is required"),
  accountCode: z.string().default(""),
  accountNumber: z.string().default(""),
  approvalChain: z.array(z.string()).default([]),
  notes: z.string().default(""),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.string().optional(),
  recurringEmail: z.string().email().optional().or(z.literal("")),
  isRunning: z.boolean().default(false),
  runningTitle: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING_CHARGE"]).optional(),
  marginEnabled: z.boolean().default(false),
  marginPercent: z.number().min(0).optional(),
  taxEnabled: z.boolean().default(false),
  taxRate: z.number().min(0).max(1).optional(),
  isCateringEvent: z.boolean().default(false),
  cateringDetails: z.unknown().optional(),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  items: z.array(invoiceItemSchema).min(1).optional(),
});

export const quickPickSchema = z.object({
  department: z.string().min(1, "Department is required"),
  description: z.string().min(1, "Description is required"),
  defaultPrice: z.number().min(0, "Price must be non-negative"),
});

export const savedLineItemSchema = z.object({
  department: z.string().min(1, "Department is required"),
  description: z.string().min(1, "Description is required"),
  unitPrice: z.number().min(0, "Price must be non-negative"),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  label: z.string().min(1, "Label is required"),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const staffAccountNumberSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  description: z.string().optional().default(""),
});

export const adminUserCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["user", "admin"]).optional(),
});

export const quoteItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Price must be non-negative"),
  sortOrder: z.number().int().default(0),
  isTaxable: z.boolean().default(true),
  marginOverride: z.number().optional(),
  costPrice: z.number().optional(),
});

export const quoteCreateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  // staffId and contactId are both optional — service layer ensures at least one is set
  staffId: z.string().optional(),
  contactId: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  category: z.string().min(1, "Category is required"),
  accountCode: z.string().default(""),
  accountNumber: z.string().default(""),
  approvalChain: z.array(z.string()).default([]),
  notes: z.string().default(""),
  items: z.array(quoteItemSchema).min(1, "At least one item is required"),
  expirationDate: z.string().min(1, "Expiration date is required"),
  recipientName: z.string().min(1, "Recipient name is required"),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientOrg: z.string().default(""),
  marginEnabled: z.boolean().default(false),
  marginPercent: z.number().min(0).optional(),
  taxEnabled: z.boolean().default(false),
  isCateringEvent: z.boolean().default(false),
  cateringDetails: z.object({
    eventDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    location: z.string(),
    contactName: z.string(),
    contactPhone: z.string(),
    contactEmail: z.string().optional(),
    headcount: z.number().optional(),
    eventName: z.string().optional(),
    setupRequired: z.boolean(),
    setupTime: z.string().optional(),
    setupInstructions: z.string().optional(),
    takedownRequired: z.boolean(),
    takedownTime: z.string().optional(),
    takedownInstructions: z.string().optional(),
    specialInstructions: z.string().optional(),
  }).optional(),
});

export const quoteUpdateSchema = quoteCreateSchema.partial().extend({
  staffId: z.string().nullable().optional(),
  items: z.array(quoteItemSchema).min(1).optional(),
  quoteStatus: z.enum(["DRAFT", "SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
  paymentMethod: z.enum(["ACCOUNT_NUMBER", "CHECK", "CASH", "CREDIT_CARD"]).optional(),
  paymentAccountNumber: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === "ACCOUNT_NUMBER" && !data.paymentAccountNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentAccountNumber"],
      message: "Payment account number is required when payment method is ACCOUNT_NUMBER",
    });
  }
});

export const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  type: z.enum(["MEETING", "SEMINAR", "VENDOR", "OTHER"]),
  date: z.string().min(1, "Date is required").regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  allDay: z.boolean().optional().default(false),
  location: z.string().nullable().optional(),
  recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).nullable().optional(),
  recurrenceEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .nullable()
    .optional(),
  reminderMinutes: z.number().int().min(0).max(10080).nullable().optional(),
});

// ── Textbook Requisitions ─────────────────────────────────────────────────

const isbnRegex = /^[0-9Xx]{10}$|^[0-9]{13}$/;

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "");
}

export const requisitionBookSchema = z.object({
  bookNumber: z.number().int().min(1).max(5),
  author: z.string().trim().min(1, "Author is required"),
  title: z.string().trim().min(1, "Title is required"),
  isbn: z
    .string()
    .trim()
    .min(1, "ISBN is required")
    .transform(normalizeIsbn)
    .pipe(z.string().regex(isbnRegex, "ISBN must be 10 or 13 digits")),
  edition: z.string().trim().optional(),
  copyrightYear: z.string().trim().optional(),
  volume: z.string().trim().optional(),
  publisher: z.string().trim().optional(),
  binding: z.enum(["HARDCOVER", "PAPERBACK", "LOOSE_LEAF", "DIGITAL"]).nullable().optional(),
  bookType: z.enum(["PHYSICAL", "OER"]).default("PHYSICAL"),
  oerLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.bookType === "OER" && !data.oerLink?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["oerLink"],
      message: "OER link is required when book type is OER",
    });
  }
});

export const requisitionCreateSchema = z.object({
  instructorName: z.string().trim().min(1, "Instructor name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  email: z.string().trim().email("Valid email is required"),
  department: z.string().trim().min(1, "Department is required"),
  course: z.string().trim().min(1, "Course is required"),
  sections: z.string().trim().min(1, "Section(s) is required"),
  enrollment: z.number().int().positive("Enrollment must be a positive number"),
  term: z.enum(["Winter", "Spring", "Summer", "Fall"], {
    message: "Term must be Winter, Spring, Summer, or Fall",
  }),
  reqYear: z.number().int().min(2020).max(2099),
  additionalInfo: z.string().trim().optional(),
  staffNotes: z.string().trim().optional(),
  status: z.enum(["PENDING", "ORDERED", "ON_SHELF"]).optional(),
  source: z.enum(["FACULTY_FORM", "STAFF_CREATED"]).optional(),
  books: z.array(requisitionBookSchema).min(1, "At least one book is required").max(5),
});

export const requisitionUpdateSchema = requisitionCreateSchema.omit({
  source: true,
}).partial().extend({
  additionalInfo: z.string().nullable().optional(),
  staffNotes: z.string().nullable().optional(),
  books: z.array(requisitionBookSchema).min(1).max(5).optional(),
});

export const requisitionStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "ORDERED", "ON_SHELF"]),
});

/** Public form: strips fields that only authenticated users should set */
export const publicRequisitionSubmitSchema = requisitionCreateSchema.omit({
  status: true,
  source: true,
  staffNotes: true,
});
