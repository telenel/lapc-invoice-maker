import * as archiveRepository from "./repository";
import { invoiceService } from "@/domains/invoice/service";
import { quoteService } from "@/domains/quote/service";
import type { ArchiveFilters, ArchiveListResponse, ArchivedDocumentResponse } from "./types";

function toArchivedDocumentResponse(
  document: NonNullable<Awaited<ReturnType<typeof archiveRepository.findById>>>,
): ArchivedDocumentResponse {
  return {
    id: document.id,
    type: document.type,
    invoiceNumber: document.invoiceNumber,
    quoteNumber: document.quoteNumber,
    status: document.status,
    quoteStatus: document.quoteStatus,
    department: document.department,
    creatorId: document.creator.id,
    creatorName: document.creator.name,
    recipientName: document.recipientName,
    recipientOrg: document.recipientOrg,
    totalAmount: Number(document.totalAmount),
    createdAt: document.createdAt.toISOString(),
    archivedAt: document.archivedAt?.toISOString() ?? document.createdAt.toISOString(),
    archivedBy: document.archiver
      ? { id: document.archiver.id, name: document.archiver.name }
      : null,
  };
}

export const archiveService = {
  async list(filters: ArchiveFilters, userId: string, isAdmin: boolean): Promise<ArchiveListResponse> {
    const { documents, total, page, pageSize } = await archiveRepository.findMany(filters, userId, isAdmin);
    return {
      documents: documents.map((document) => toArchivedDocumentResponse(document)),
      total,
      page,
      pageSize,
    };
  },

  async restore(id: string, userId: string, isAdmin: boolean): Promise<{ id: string; type: "INVOICE" | "QUOTE" }> {
    const document = await archiveRepository.findById(id);
    if (!document?.archivedAt) {
      throw Object.assign(new Error("Archived document not found"), { code: "NOT_FOUND" });
    }
    if (!isAdmin && document.createdBy !== userId) {
      throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    }

    if (document.type === "QUOTE") {
      await quoteService.restore(id);
      return { id, type: "QUOTE" };
    }

    await invoiceService.restore(id);
    return { id, type: "INVOICE" };
  },
};
