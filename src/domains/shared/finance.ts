import type { Prisma } from "@/generated/prisma/client";

const EXPECTED_QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "SUBMITTED_EMAIL",
  "SUBMITTED_MANUAL",
  "ACCEPTED",
] as const;

export type FinanceDocumentShape = {
  type: string;
  status: string | null;
  quoteStatus: string | null;
  convertedToInvoiceId?: string | null;
};

export function isFinalizedFinanceDocument(document: FinanceDocumentShape): boolean {
  return document.type === "INVOICE" && document.status === "FINAL";
}

export function isExpectedFinanceDocument(document: FinanceDocumentShape): boolean {
  if (document.type === "INVOICE") {
    return document.status === "DRAFT" || document.status === "PENDING_CHARGE";
  }

  if (document.type === "QUOTE") {
    return Boolean(
      document.quoteStatus &&
      EXPECTED_QUOTE_STATUSES.includes(document.quoteStatus as typeof EXPECTED_QUOTE_STATUSES[number]) &&
      !document.convertedToInvoiceId,
    );
  }

  return false;
}

export function buildIncludedFinanceWhere(
  dateFrom?: string,
  dateTo?: string,
): Prisma.InvoiceWhereInput {
  const date =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        }
      : undefined;

  return {
    ...(date ? { date } : {}),
    OR: [
      {
        type: "INVOICE",
        status: { in: ["FINAL", "DRAFT", "PENDING_CHARGE"] },
      },
      {
        type: "QUOTE",
        quoteStatus: { in: [...EXPECTED_QUOTE_STATUSES] },
        convertedToInvoice: null,
      },
    ],
  };
}

export function buildExpectedFinanceWhere(): Prisma.InvoiceWhereInput {
  return {
    archivedAt: null,
    OR: [
      {
        type: "INVOICE",
        status: { in: ["DRAFT", "PENDING_CHARGE"] },
      },
      {
        type: "QUOTE",
        quoteStatus: { in: [...EXPECTED_QUOTE_STATUSES] },
        convertedToInvoice: null,
      },
    ],
  };
}
