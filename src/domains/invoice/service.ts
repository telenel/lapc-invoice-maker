// src/domains/invoice/service.ts
import * as invoiceRepository from "./repository";
import { calculateLineItems, calculateTotal } from "./calculations";
import { pdfService } from "@/domains/pdf/service";
import { staffService } from "@/domains/staff/service";
import { formatCurrency, formatDateFromDate } from "@/domains/shared/formatters";
import { safePublishAll } from "@/lib/sse";
import type {
  InvoiceResponse,
  InvoiceItemResponse,
  InvoiceFilters,
  CreateInvoiceInput,
  FinalizeInput,
  InvoiceStatsResponse,
} from "./types";
import type { InvoiceStaffDetail } from "./types";
import type { ContactResponse } from "@/domains/contact/types";
import type { Prisma } from "@/generated/prisma/client";

// ── Signature parser ───────────────────────────────────────────────────────

function parseSignature(raw: string): { name: string; title?: string } {
  const commaIdx = raw.indexOf(",");
  if (commaIdx === -1) return { name: raw.trim() };
  return {
    name: raw.slice(0, commaIdx).trim(),
    title: raw.slice(commaIdx + 1).trim() || undefined,
  };
}

// ── Creator stats ──────────────────────────────────────────────────────────

export interface CreatorStatEntry {
  id: string;
  name: string;
  invoiceCount: number;
  totalAmount: number;
}

// ── DTO mapper ─────────────────────────────────────────────────────────────

type InvoiceWithRelations = Awaited<ReturnType<typeof invoiceRepository.findById>>;

function toInvoiceResponse(invoice: NonNullable<InvoiceWithRelations>): InvoiceResponse {
  const staff: InvoiceStaffDetail | null = invoice.staff
    ? {
        id: invoice.staff.id,
        name: invoice.staff.name,
        title: invoice.staff.title,
        department: invoice.staff.department,
        extension: (invoice.staff as { extension?: string | null }).extension ?? null,
        email: (invoice.staff as { email?: string | null }).email ?? null,
      }
    : null;

  const contactRaw = (invoice as { contact?: { id: string; name: string; email: string; phone: string; org: string; department: string; title: string; notes: string | null; createdAt: Date } | null }).contact;
  const contact: ContactResponse | null = contactRaw
    ? {
        id: contactRaw.id,
        name: contactRaw.name,
        email: contactRaw.email,
        phone: contactRaw.phone,
        org: contactRaw.org,
        department: contactRaw.department,
        title: contactRaw.title,
        notes: contactRaw.notes,
        createdAt: contactRaw.createdAt.toISOString(),
      }
    : null;

  const items: InvoiceItemResponse[] = invoice.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    extendedPrice: Number(item.extendedPrice),
    sortOrder: item.sortOrder,
    isTaxable: item.isTaxable,
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
  }));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date.toISOString(),
    status: invoice.status as InvoiceResponse["status"],
    type: invoice.type,
    department: invoice.department,
    category: invoice.category,
    accountCode: invoice.accountCode,
    accountNumber: invoice.accountNumber ?? "",
    approvalChain: (invoice.approvalChain as string[]) ?? [],
    notes: invoice.notes ?? "",
    totalAmount: Number(invoice.totalAmount),
    isRecurring: invoice.isRecurring,
    recurringInterval: invoice.recurringInterval,
    recurringEmail: invoice.recurringEmail,
    isRunning: invoice.isRunning,
    runningTitle: invoice.runningTitle,
    pdfPath: invoice.pdfPath,
    prismcorePath: invoice.prismcorePath,
    marginEnabled: invoice.marginEnabled,
    marginPercent: invoice.marginPercent != null ? Number(invoice.marginPercent) : null,
    taxEnabled: invoice.taxEnabled,
    taxRate: Number(invoice.taxRate),
    isCateringEvent: invoice.isCateringEvent,
    cateringDetails: invoice.cateringDetails,
    createdAt: invoice.createdAt.toISOString(),
    staff,
    contact,
    creatorId: invoice.creator.id,
    creatorName: invoice.creator.name,
    items,
  };
}

// ── Service ────────────────────────────────────────────────────────────────

export const invoiceService = {
  /**
   * Paginated list of invoices with filtering, mapped to DTOs.
   */
  async list(filters: InvoiceFilters & { sortBy?: string; sortOrder?: "asc" | "desc" }) {
    const { invoices, total, page, pageSize } = await invoiceRepository.findMany(filters);
    return {
      invoices: invoices.map((inv) => toInvoiceResponse(inv as unknown as NonNullable<InvoiceWithRelations>)),
      total,
      page,
      pageSize,
    };
  },

  /**
   * Single invoice by ID, or null if not found.
   */
  async getById(id: string): Promise<InvoiceResponse | null> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) return null;
    return toInvoiceResponse(invoice);
  },

  /**
   * Create an invoice with calculated line items and totals.
   * Non-critically saves account number to staff record.
   */
  async create(input: CreateInvoiceInput, creatorId: string): Promise<InvoiceResponse> {
    const { items, ...invoiceData } = input;

    const calculatedItems = calculateLineItems(items);
    const totalAmount = calculateTotal(
      calculatedItems,
      invoiceData.marginEnabled,
      invoiceData.marginPercent ? Number(invoiceData.marginPercent) : undefined,
      invoiceData.taxEnabled,
      invoiceData.taxRate ? Number(invoiceData.taxRate) : undefined
    );

    const { cateringDetails, ...restInvoiceData } = invoiceData;
    const invoice = await invoiceRepository.create(
      {
        ...restInvoiceData,
        accountCode: restInvoiceData.accountCode ?? "",
        cateringDetails: cateringDetails as Prisma.InputJsonValue | undefined,
      },
      calculatedItems,
      totalAmount,
      creatorId
    );

    // Non-critical: save account number for this staff member
    if (invoiceData.accountNumber && invoiceData.staffId) {
      staffService
        .upsertAccountNumber({
          staffId: invoiceData.staffId,
          accountCode: invoiceData.accountNumber,
        })
        .catch(() => {});
    }

    safePublishAll({ type: "invoice-changed" });

    return toInvoiceResponse(invoice);
  },

  /**
   * Duplicate an invoice as a new DRAFT with date reset to today.
   * Copies all fields except invoiceNumber, pdfPath, convertedFromQuoteId, and revisedFromQuoteId.
   */
  async duplicate(id: string, creatorId: string): Promise<InvoiceResponse> {
    const source = await invoiceRepository.findById(id);
    if (!source) {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }

    const items: CreateInvoiceInput["items"] = source.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      isTaxable: item.isTaxable,
      costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
      marginOverride: item.marginOverride != null ? Number(item.marginOverride) : undefined,
    }));

    const calculatedItems = calculateLineItems(items);
    const totalAmount = calculateTotal(
      calculatedItems,
      source.marginEnabled,
      source.marginPercent != null ? Number(source.marginPercent) : undefined,
      source.taxEnabled,
      source.taxRate != null ? Number(source.taxRate) : undefined
    );

    const invoice = await invoiceRepository.create(
      {
        date: new Date().toISOString().split("T")[0],
        category: source.category,
        department: source.department,
        staffId: source.staffId ?? undefined,
        contactId: (source as { contactId?: string | null }).contactId ?? undefined,
        accountCode: source.accountCode,
        accountNumber: source.accountNumber ?? undefined,
        approvalChain: (source.approvalChain as string[]) ?? [],
        notes: source.notes ?? undefined,
        marginEnabled: source.marginEnabled,
        marginPercent: source.marginPercent != null ? Number(source.marginPercent) : undefined,
        taxEnabled: source.taxEnabled,
        taxRate: source.taxRate != null ? Number(source.taxRate) : undefined,
        isCateringEvent: source.isCateringEvent,
        cateringDetails: source.cateringDetails as Prisma.InputJsonValue | undefined,
      },
      calculatedItems,
      totalAmount,
      creatorId
    );

    safePublishAll({ type: "invoice-changed" });

    return toInvoiceResponse(invoice);
  },

  /**
   * Update an invoice. Blocks updates on FINAL invoices.
   * Recalculates totals if items are provided.
   */
  async update(
    id: string,
    input: { items?: CreateInvoiceInput["items"]; [key: string]: unknown }
  ): Promise<InvoiceResponse> {
    const existing = await invoiceRepository.findById(id);
    if (!existing) {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }
    if (existing.status === "FINAL") {
      throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
    }

    const { items, ...invoiceData } = input;

    if (items && Array.isArray(items)) {
      const calculatedItems = calculateLineItems(items);
      const mEnabled = Boolean(invoiceData.marginEnabled ?? existing.marginEnabled);
      const mPercent = invoiceData.marginPercent != null ? Number(invoiceData.marginPercent) : (existing.marginPercent != null ? Number(existing.marginPercent) : undefined);
      const tEnabled = Boolean(invoiceData.taxEnabled ?? existing.taxEnabled);
      const tRate = invoiceData.taxRate != null ? Number(invoiceData.taxRate) : (existing.taxRate != null ? Number(existing.taxRate) : undefined);
      const totalAmount = calculateTotal(calculatedItems, mEnabled, mPercent, tEnabled, tRate);
      const updated = await invoiceRepository.update(id, invoiceData, calculatedItems, totalAmount);
      safePublishAll({ type: "invoice-changed" });
      return toInvoiceResponse(updated as unknown as NonNullable<InvoiceWithRelations>);
    }

    const updated = await invoiceRepository.update(id, invoiceData);
    safePublishAll({ type: "invoice-changed" });
    return toInvoiceResponse(updated as unknown as NonNullable<InvoiceWithRelations>);
  },

  /**
   * Delete an invoice, cleaning up PDF files first.
   */
  async delete(id: string): Promise<void> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }

    // Clean up PDF files
    const pdfPath = invoice.status === "FINAL" ? invoice.pdfPath : null;
    await pdfService.deletePdfFiles(pdfPath, invoice.prismcorePath);

    await invoiceRepository.deleteById(id);
    safePublishAll({ type: "invoice-changed" });
  },

  /**
   * Finalize an invoice: generate PDFs, optionally merge PrismCore,
   * update status to FINAL, record signer history, increment quick pick usage.
   */
  async finalize(id: string, input: FinalizeInput): Promise<{ pdfPath: string }> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }

    if (!invoice.invoiceNumber) {
      throw Object.assign(
        new Error("Enter the AG invoice number before finalizing"),
        { code: "VALIDATION" }
      );
    }

    const {
      prismcorePath,
      signatures,
      signatureStaffIds,
      semesterYearDept,
      contactName,
      contactExtension,
    } = input;

    // Parse signature strings ("Name, Title") into structured objects
    const resolvedSignatures: { name: string; title?: string }[] = [];
    if (signatures) {
      if (signatures.line1) resolvedSignatures.push(parseSignature(signatures.line1));
      if (signatures.line2) resolvedSignatures.push(parseSignature(signatures.line2));
      if (signatures.line3) resolvedSignatures.push(parseSignature(signatures.line3));
    }

    const dateStr = formatDateFromDate(new Date(invoice.date));
    const totalStr = formatCurrency(Number(invoice.totalAmount));

    // Generate PDF
    const pdfPath = await pdfService.generateInvoice({
      coverSheet: {
        date: dateStr,
        semesterYearDept: semesterYearDept ?? invoice.department,
        invoiceNumber: invoice.invoiceNumber ?? "",
        chargeAccountNumber: invoice.accountNumber ?? invoice.accountCode,
        accountCode: invoice.accountCode,
        totalAmount: totalStr,
        signatures: resolvedSignatures,
      },
      idp: {
        date: dateStr,
        department: invoice.department,
        documentNumber: invoice.invoiceNumber ?? "",
        requestingDept: invoice.department,
        sapAccount: invoice.accountNumber ?? invoice.accountCode,
        estimatedCost: totalStr,
        approverName: resolvedSignatures.length > 0 ? resolvedSignatures[0].name : "",
        contactName: contactName ?? invoice.staff?.name ?? (invoice as { contact?: { name: string } | null }).contact?.name ?? "",
        contactPhone: contactExtension ?? (invoice.staff as { extension?: string } | null)?.extension ?? (invoice as { contact?: { phone?: string } | null }).contact?.phone ?? "",
        items: invoice.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: formatCurrency(Number(item.unitPrice)),
          extendedPrice: formatCurrency(Number(item.extendedPrice)),
        })),
        totalAmount: totalStr,
      },
    });

    // Optionally merge PrismCore PDF
    if (prismcorePath) {
      await pdfService.mergePrismCore(pdfPath, prismcorePath);
    }

    // Finalize in DB
    await invoiceRepository.finalize(id, pdfPath, prismcorePath);

    // Post-finalize: non-critical operations
    const postUpdates: Promise<unknown>[] = [];

    // Record signer history
    if (signatureStaffIds && invoice.staffId) {
      const signerLines = [
        { line: signatureStaffIds.line1, position: 0 },
        { line: signatureStaffIds.line2, position: 1 },
        { line: signatureStaffIds.line3, position: 2 },
      ];
      for (const { line, position } of signerLines) {
        if (line) {
          postUpdates.push(
            staffService.recordSignerHistory(id, invoice.staffId, position, line)
          );
        }
      }
    }

    // Increment quick pick and saved line item usage counts
    const descriptions = invoice.items.map((item) => item.description);
    if (descriptions.length > 0) {
      postUpdates.push(
        invoiceRepository.incrementQuickPickUsage(invoice.department, descriptions)
      );
    }

    // Run all post-finalize updates in parallel, non-critically
    await Promise.all(postUpdates).catch(() => {});

    safePublishAll({ type: "invoice-changed" });

    return { pdfPath };
  },

  /**
   * Aggregate count + sum stats for the given filters.
   */
  async getStats(filters: InvoiceFilters): Promise<InvoiceStatsResponse> {
    return invoiceRepository.countAndSum(filters);
  },

  /**
   * Aggregate invoice stats grouped by creator for the current month.
   * Used by the pending-charges dashboard panel.
   */
  async getCreatorStats(status?: InvoiceFilters["status"]): Promise<{ users: CreatorStatEntry[] }> {
    return invoiceRepository.countByCreator(status);
  },
};
