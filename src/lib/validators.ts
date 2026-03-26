import { z } from "zod";

export const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().min(1, "Title is required"),
  department: z.string().min(1, "Department is required"),
  accountCode: z.string().default(""),
  extension: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  approvalChain: z.array(z.string()).default([]),
});

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Price must be non-negative"),
  sortOrder: z.number().int().default(0),
});

export const invoiceCreateSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  date: z.string().min(1, "Date is required"),
  staffId: z.string().min(1, "Staff member is required"),
  department: z.string().min(1, "Department is required"),
  category: z.string().min(1, "Category is required"),
  accountCode: z.string().default(""),
  accountNumber: z.string().default(""),
  approvalChain: z.array(z.string()).default([]),
  notes: z.string().default(""),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
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
