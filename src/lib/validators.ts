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
  staffId: z.string().min(1, "Staff member is required"),
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
  staffId: z.string().min(1, "Staff member is required"),
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
  items: z.array(quoteItemSchema).min(1).optional(),
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
