// src/domains/invoice/service.ts
import * as invoiceRepository from "./repository";
import { calculateLineItems, calculateTotal } from "./calculations";
import { pdfService } from "@/domains/pdf/service";
import { pdfStorage } from "@/domains/pdf/storage";
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
  InvoicePdfMetadata,
  ArchivedBySummary,
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

function assertInvoiceIsActive(invoice: { archivedAt?: Date | null }) {
  if (invoice.archivedAt) {
    throw Object.assign(
      new Error("Archived invoices must be restored before they can be changed"),
      { code: "FORBIDDEN" },
    );
  }
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

  const archivedBy = "archiver" in invoice
    ? ((invoice as { archiver?: ArchivedBySummary | null }).archiver ?? null)
    : null;

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
    pdfMetadata: (invoice.pdfMetadata as InvoicePdfMetadata | null) ?? null,
    prismcorePath: invoice.prismcorePath,
    marginEnabled: invoice.marginEnabled,
    marginPercent: invoice.marginPercent != null ? Number(invoice.marginPercent) : null,
    taxEnabled: invoice.taxEnabled,
    taxRate: Number(invoice.taxRate),
    isCateringEvent: invoice.isCateringEvent,
    cateringDetails: invoice.cateringDetails,
    createdAt: invoice.createdAt.toISOString(),
    archivedAt: invoice.archivedAt?.toISOString() ?? null,
    archivedBy,
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
  async getById(id: string, options?: { includeArchived?: boolean }): Promise<InvoiceResponse | null> {
    const invoice = await invoiceRepository.findById(id, options);
    if (!invoice || invoice.type !== "INVOICE") return null;
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
      invoiceData.taxRate != null ? Number(invoiceData.taxRate) : undefined
    );

    const { cateringDetails, ...restInvoiceData } = invoiceData;
    const invoice = await invoiceRepository.create(
      {
        ...restInvoiceData,
        accountCode: restInvoiceData.accountCode ?? "",
        prismcorePath: restInvoiceData.prismcorePath ?? null,
        pdfMetadata: restInvoiceData.pdfMetadata as Prisma.InputJsonValue | undefined,
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
    if (!source || source.type !== "INVOICE") {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }
    assertInvoiceIsActive(source);

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
        prismcorePath: source.prismcorePath ?? null,
        pdfMetadata: source.pdfMetadata as Prisma.InputJsonValue | undefined,
        marginEnabled: source.marginEnabled,
        marginPercent: source.marginPercent != null ? Number(source.marginPercent) : undefined,
        taxEnabled: source.taxEnabled,
        taxRate: source.taxRate != null ? Number(source.taxRate) : undefined,
        isRecurring: source.isRecurring ?? undefined,
        recurringInterval: source.recurringInterval ?? undefined,
        recurringEmail: source.recurringEmail ?? undefined,
        isRunning: source.isRunning ?? undefined,
        runningTitle: source.runningTitle ?? undefined,
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
    if (!existing || existing.type !== "INVOICE") {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }
    if (existing.status === "FINAL") {
      throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
    }
    assertInvoiceIsActive(existing);

    const { items, ...invoiceData } = input;

    const mEnabled = Boolean(invoiceData.marginEnabled ?? existing.marginEnabled);
    const mPercent = invoiceData.marginPercent != null ? Number(invoiceData.marginPercent) : (existing.marginPercent != null ? Number(existing.marginPercent) : undefined);
    const tEnabled = Boolean(invoiceData.taxEnabled ?? existing.taxEnabled);
    const tRate = invoiceData.taxRate != null ? Number(invoiceData.taxRate) : (existing.taxRate != null ? Number(existing.taxRate) : undefined);

    const needsRecalc = items && Array.isArray(items)
      || invoiceData.marginEnabled !== undefined
      || invoiceData.marginPercent !== undefined
      || invoiceData.taxEnabled !== undefined
      || invoiceData.taxRate !== undefined;

    if (needsRecalc) {
      const sourceItems = items && Array.isArray(items)
        ? items
        : existing.items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            isTaxable: item.isTaxable,
            costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
            marginOverride: item.marginOverride != null ? Number(item.marginOverride) : undefined,
          }));
      const calculatedItems = calculateLineItems(sourceItems);
      const totalAmount = calculateTotal(calculatedItems, mEnabled, mPercent, tEnabled, tRate);
      const updated = await invoiceRepository.update(id, invoiceData, calculatedItems, totalAmount);
      if (invoiceData.accountNumber && !existing.accountNumber) {
        closeFollowUpSeriesOnAccountNumber(id).catch(() => {});
      }
      safePublishAll({ type: "invoice-changed" });
      return toInvoiceResponse(updated as unknown as NonNullable<InvoiceWithRelations>);
    }

    const updated = await invoiceRepository.update(id, invoiceData);
    if (invoiceData.accountNumber && !existing.accountNumber) {
      closeFollowUpSeriesOnAccountNumber(id).catch(() => {});
    }
    safePublishAll({ type: "invoice-changed" });
    return toInvoiceResponse(updated as unknown as NonNullable<InvoiceWithRelations>);
  },

  /**
   * Delete an invoice, cleaning up PDF files first.
   */
  async delete(id: string): Promise<void> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice || invoice.type !== "INVOICE") {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }

    // Clean up PDF files
    const pdfPath = invoice.status === "FINAL" ? invoice.pdfPath : null;
    await pdfService.deletePdfFiles(pdfPath, invoice.prismcorePath);

    await invoiceRepository.deleteById(id);
    safePublishAll({ type: "invoice-changed" });
  },

  async archive(id: string, actorId: string): Promise<void> {
    const invoice = await invoiceRepository.findById(id, { includeArchived: true });
    if (!invoice || invoice.type !== "INVOICE") {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }

    await invoiceRepository.archiveById(id, actorId);
    safePublishAll({ type: "invoice-changed" });
  },

  async restore(id: string): Promise<InvoiceResponse> {
    const invoice = await invoiceRepository.restoreById(id);
    return toInvoiceResponse(invoice as NonNullable<InvoiceWithRelations>);
  },

  /**
   * Finalize an invoice: generate PDFs, optionally merge PrismCore,
   * update status to FINAL, record signer history, increment quick pick usage.
   */
  async finalize(id: string, input: FinalizeInput): Promise<{ pdfPath: string }> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice || invoice.type !== "INVOICE") {
      throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
    }
    assertInvoiceIsActive(invoice);

    if (!invoice.invoiceNumber) {
      throw Object.assign(
        new Error("Enter the AG invoice number before finalizing"),
        { code: "VALIDATION" }
      );
    }

    const storedPdfMetadata = (invoice.pdfMetadata as InvoicePdfMetadata | null) ?? null;
    const mergedPdfMetadata: InvoicePdfMetadata = {
      signatures: {
        line1: input.signatures?.line1 ?? storedPdfMetadata?.signatures?.line1,
        line2: input.signatures?.line2 ?? storedPdfMetadata?.signatures?.line2,
        line3: input.signatures?.line3 ?? storedPdfMetadata?.signatures?.line3,
      },
      signatureStaffIds: {
        line1: input.signatureStaffIds?.line1 ?? storedPdfMetadata?.signatureStaffIds?.line1,
        line2: input.signatureStaffIds?.line2 ?? storedPdfMetadata?.signatureStaffIds?.line2,
        line3: input.signatureStaffIds?.line3 ?? storedPdfMetadata?.signatureStaffIds?.line3,
      },
      semesterYearDept: input.semesterYearDept ?? storedPdfMetadata?.semesterYearDept,
      contactName: input.contactName ?? storedPdfMetadata?.contactName,
      contactExtension: input.contactExtension ?? storedPdfMetadata?.contactExtension,
    };
    const prismcorePath = input.prismcorePath ?? invoice.prismcorePath ?? null;

    // Parse signature strings ("Name, Title") into structured objects
    const resolvedSignatures: { name: string; title?: string }[] = [];
    if (mergedPdfMetadata.signatures) {
      if (mergedPdfMetadata.signatures.line1) resolvedSignatures.push(parseSignature(mergedPdfMetadata.signatures.line1));
      if (mergedPdfMetadata.signatures.line2) resolvedSignatures.push(parseSignature(mergedPdfMetadata.signatures.line2));
      if (mergedPdfMetadata.signatures.line3) resolvedSignatures.push(parseSignature(mergedPdfMetadata.signatures.line3));
    }

    const dateStr = formatDateFromDate(new Date(invoice.date));
    const totalStr = formatCurrency(Number(invoice.totalAmount));

    // Generate PDF
    const pdfPath = await pdfService.generateInvoice({
      coverSheet: {
        date: dateStr,
        semesterYearDept: mergedPdfMetadata.semesterYearDept ?? invoice.department,
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
        contactName: mergedPdfMetadata.contactName ?? invoice.staff?.name ?? (invoice as { contact?: { name: string } | null }).contact?.name ?? "",
        contactPhone: mergedPdfMetadata.contactExtension ?? (invoice.staff as { extension?: string } | null)?.extension ?? (invoice as { contact?: { phone?: string } | null }).contact?.phone ?? "",
        items: invoice.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: formatCurrency(Number(item.unitPrice)),
          extendedPrice: formatCurrency(Number(item.extendedPrice)),
        })),
        totalAmount: totalStr,
      },
    }, pdfStorage.invoiceKey(id, invoice.invoiceNumber));

    // Optionally merge PrismCore PDF
    if (prismcorePath) {
      await pdfService.mergePrismCore(pdfPath, prismcorePath);
    }

    // Finalize in DB
    await invoiceRepository.finalize(
      id,
      pdfPath,
      prismcorePath,
      mergedPdfMetadata as Prisma.InputJsonValue
    );

    // Post-finalize: non-critical operations
    const postUpdates: Promise<unknown>[] = [];

    // Record signer history
    if (mergedPdfMetadata.signatureStaffIds && invoice.staffId) {
      const signerLines = [
        { line: mergedPdfMetadata.signatureStaffIds.line1, position: 0 },
        { line: mergedPdfMetadata.signatureStaffIds.line2, position: 1 },
        { line: mergedPdfMetadata.signatureStaffIds.line3, position: 2 },
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

async function closeFollowUpSeriesOnAccountNumber(invoiceId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.followUp.updateMany({
    where: {
      invoiceId,
      seriesStatus: "ACTIVE",
      type: { in: ["ACCOUNT_FOLLOWUP", "ACCOUNT_FOLLOWUP_CLAIM"] },
    },
    data: { seriesStatus: "COMPLETED" },
  });
}
