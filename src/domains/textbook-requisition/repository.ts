// src/domains/textbook-requisition/repository.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  RequisitionFilters,
  CreateRequisitionInput,
  UpdateRequisitionInput,
} from "./types";

// ── Shared include shape ──────────────────────────────────────────────────

const includeAll = {
  books: { orderBy: { bookNumber: "asc" as const } },
  notifications: {
    orderBy: { sentAt: "desc" as const },
    include: { sender: { select: { id: true, name: true } } },
  },
  creator: { select: { id: true, name: true } },
  statusChanger: { select: { id: true, name: true } },
} as const;

// ── Where builder ─────────────────────────────────────────────────────────

function buildWhere(
  filters: RequisitionFilters,
): Prisma.TextbookRequisitionWhereInput {
  // Always exclude archived records from normal queries
  const where: Prisma.TextbookRequisitionWhereInput = { archivedAt: null };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.term) {
    where.term = filters.term;
  }
  if (filters.year) {
    where.reqYear = filters.year;
  }
  if (filters.createdBy) {
    where.createdBy = filters.createdBy;
  }
  if (filters.search) {
    where.OR = [
      {
        instructorName: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      { email: { contains: filters.search, mode: "insensitive" } },
      {
        department: { contains: filters.search, mode: "insensitive" },
      },
      { course: { contains: filters.search, mode: "insensitive" } },
      {
        sections: { contains: filters.search, mode: "insensitive" },
      },
      { phone: { contains: filters.search, mode: "insensitive" } },
      {
        additionalInfo: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        staffNotes: { contains: filters.search, mode: "insensitive" },
      },
      {
        books: {
          some: {
            author: { contains: filters.search, mode: "insensitive" },
          },
        },
      },
      {
        books: {
          some: {
            title: { contains: filters.search, mode: "insensitive" },
          },
        },
      },
      {
        books: {
          some: {
            isbn: { contains: filters.search, mode: "insensitive" },
          },
        },
      },
      {
        books: {
          some: {
            publisher: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
}

// ── Allowed sort fields ───────────────────────────────────────────────────

const ALLOWED_SORT_FIELDS = new Set([
  "submittedAt",
  "updatedAt",
  "instructorName",
  "department",
  "course",
  "status",
  "source",
  "term",
  "reqYear",
]);

const DEFAULT_SORT_FIELD = "submittedAt";

// ── Repository methods ────────────────────────────────────────────────────

/**
 * Paginated list of requisitions with filtering and sorting.
 */
export async function findMany(
  filters: RequisitionFilters & {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) {
  const where = buildWhere(filters);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const sortField = ALLOWED_SORT_FIELDS.has(filters.sortBy ?? "")
    ? (filters.sortBy ?? DEFAULT_SORT_FIELD)
    : DEFAULT_SORT_FIELD;
  const sortDir = filters.sortOrder ?? "desc";

  const [requisitions, total] = await prisma.$transaction([
    prisma.textbookRequisition.findMany({
      where,
      include: includeAll,
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.textbookRequisition.count({ where }),
  ]);

  return { requisitions, total, page, pageSize };
}

/**
 * Single requisition with all relations.
 */
export async function findById(id: string) {
  return prisma.textbookRequisition.findFirst({
    where: { id, archivedAt: null },
    include: includeAll,
  });
}

/**
 * Create a requisition with nested books.
 */
export async function create(input: CreateRequisitionInput) {
  const { books, ...requisitionData } = input;

  return prisma.textbookRequisition.create({
    data: {
      ...requisitionData,
      books: {
        create: books.map((book) => ({
          bookNumber: book.bookNumber,
          author: book.author,
          title: book.title,
          isbn: book.isbn,
          edition: book.edition ?? null,
          copyrightYear: book.copyrightYear ?? null,
          volume: book.volume ?? null,
          publisher: book.publisher ?? null,
          binding: book.binding ?? null,
          bookType: book.bookType ?? "PHYSICAL",
          oerLink: book.oerLink ?? null,
        })),
      },
    },
    include: includeAll,
  });
}

export async function findByEmployeeId(employeeId: string, limit = 20) {
  return prisma.textbookRequisition.findMany({
    where: {
      employeeId,
      archivedAt: null,
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
    include: {
      books: { orderBy: { bookNumber: "asc" } },
    },
  });
}

/**
 * Update a requisition, optionally replacing all books in a transaction.
 */
export async function update(
  id: string,
  input: UpdateRequisitionInput,
  userId?: string,
) {
  const { books, ...updateData } = input;
  const statusChanged = updateData.status !== undefined;

  const data: Prisma.TextbookRequisitionUncheckedUpdateInput = {
    ...updateData,
  };
  if (statusChanged) {
    data.lastStatusChangedAt = new Date();
    data.lastStatusChangedBy = userId ?? null;
  }

  if (books != null) {
    const [, requisition] = await prisma.$transaction([
      prisma.requisitionBook.deleteMany({
        where: { requisitionId: id },
      }),
      prisma.textbookRequisition.update({
        where: { id },
        data: {
          ...data,
          books: {
            create: books.map((book) => ({
              bookNumber: book.bookNumber,
              author: book.author,
              title: book.title,
              isbn: book.isbn,
              edition: book.edition ?? null,
              copyrightYear: book.copyrightYear ?? null,
              volume: book.volume ?? null,
              publisher: book.publisher ?? null,
              binding: book.binding ?? null,
              bookType: book.bookType ?? "PHYSICAL",
              oerLink: book.oerLink ?? null,
            })),
          },
        },
        include: includeAll,
      }),
    ]);

    return requisition;
  }

  return prisma.textbookRequisition.update({
    where: { id },
    data,
    include: includeAll,
  });
}

/**
 * Update only the status with audit fields.
 */
export async function updateStatus(
  id: string,
  status: string,
  userId: string,
) {
  return prisma.textbookRequisition.update({
    where: { id },
    data: {
      status: status as Prisma.TextbookRequisitionUpdateInput["status"],
      lastStatusChangedAt: new Date(),
      lastStatusChangedBy: userId,
    },
    include: includeAll,
  });
}

/**
 * Hard delete a requisition (cascade removes books and notifications via DB constraint).
 */
/**
 * Soft delete — sets archivedAt/archivedBy. Record and its audit trail are preserved.
 */
export async function archiveById(id: string, userId: string) {
  return prisma.textbookRequisition.update({
    where: { id },
    data: { archivedAt: new Date(), archivedBy: userId },
    include: includeAll,
  });
}

/**
 * Aggregate counts by status for the stats panel.
 */
export async function countByStatus() {
  const active = { archivedAt: null };
  const [pending, ordered, onShelf, total] = await prisma.$transaction([
    prisma.textbookRequisition.count({ where: { ...active, status: "PENDING" } }),
    prisma.textbookRequisition.count({ where: { ...active, status: "ORDERED" } }),
    prisma.textbookRequisition.count({ where: { ...active, status: "ON_SHELF" } }),
    prisma.textbookRequisition.count({ where: active }),
  ]);

  return { pending, ordered, onShelf, total };
}

/**
 * Get distinct years from all requisitions, sorted descending.
 */
export async function getDistinctYears(): Promise<number[]> {
  const rows = await prisma.textbookRequisition.findMany({
    select: { reqYear: true },
    distinct: ["reqYear"],
    orderBy: { reqYear: "desc" },
  });

  return rows.map((r) => r.reqYear);
}

/**
 * Create a notification audit record for a requisition.
 */
export async function createNotification(data: {
  requisitionId: string;
  type: string;
  recipientEmail: string;
  subject: string;
  success: boolean;
  sentBy?: string | null;
  errorMessage?: string | null;
}) {
  return prisma.requisitionNotification.create({ data });
}

export async function updateNotification(
  id: string,
  data: { success: boolean; errorMessage: string | null },
) {
  return prisma.requisitionNotification.update({ where: { id }, data });
}

/**
 * Claim result — discriminated so the caller can distinguish
 * "already sent" from "another request is sending" from "you own the slot."
 */
export type ClaimResult =
  | { status: "already_sent" }
  | { status: "in_progress" }
  | { status: "stale_sending" }
  | { status: "claimed"; notificationId: string };

/**
 * Atomically claim a notification send slot for (requisitionId, type).
 *
 * Design:
 * - APPEND-ONLY: each attempt creates a NEW row. Prior rows are never mutated
 *   (preserving full audit history of all attempts).
 * - Advisory lock serializes the claim transaction.
 * - The latest row's errorMessage="SENDING" acts as a distributed lock that
 *   persists after the advisory lock releases, preventing concurrent sends.
 * - Stale SENDING rows (>60s) are treated conservatively as "possibly sent"
 *   because the process may have crashed AFTER the email was delivered.
 *   This prevents duplicate emails at the cost of possibly missing a retry
 *   for a send that never actually happened. Manual re-send is the safe path.
 *
 * Returns a discriminated result:
 * - already_sent: a prior attempt succeeded OR was stale SENDING (conservative skip)
 * - in_progress: another request is actively sending (back off)
 * - claimed: this request owns the slot (proceed to send email)
 *
 * Only rows with explicit failure (errorMessage != "SENDING") are retryable.
 */
const SENDING_TIMEOUT_MS = 60_000;

export async function claimNotificationSlot(data: {
  requisitionId: string;
  type: string;
  recipientEmail: string;
  subject: string;
  sentBy: string;
}): Promise<ClaimResult> {
  return prisma.$transaction(async (tx) => {
    // Advisory lock serializes concurrent claim attempts
    await tx.$queryRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      `requisition-notify:${data.requisitionId}:${data.type}`,
    );

    // Check the latest notification for this (requisitionId, type)
    const latest = await tx.requisitionNotification.findFirst({
      where: { requisitionId: data.requisitionId, type: data.type },
      orderBy: { sentAt: "desc" },
    });

    if (latest?.success) {
      return { status: "already_sent" as const };
    }

    if (latest?.errorMessage === "SENDING") {
      const age = Date.now() - latest.sentAt.getTime();
      if (age < SENDING_TIMEOUT_MS) {
        // Fresh SENDING — another request is actively working on this
        return { status: "in_progress" as const };
      }
      // Stale SENDING — process crashed mid-send. Delivery status is unknown.
      // Return a distinct state so the caller can show a manual-override prompt.
      await tx.requisitionNotification.update({
        where: { id: latest.id },
        data: { errorMessage: "Process crashed during send — delivery unknown" },
      });
      return { status: "stale_sending" as const };
    }

    if (latest) {
      // Explicit failure (errorMessage is set, not "SENDING") — retryable.
      // Create a NEW attempt row (append-only audit trail).
    }

    // Create a new attempt row
    const notification = await tx.requisitionNotification.create({
      data: {
        requisitionId: data.requisitionId,
        type: data.type,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        success: false,
        sentBy: data.sentBy,
        errorMessage: "SENDING",
      },
    });
    return { status: "claimed" as const, notificationId: notification.id };
  });
}

/**
 * Count PENDING requisitions that have at least one attention flag.
 *
 * Attention flags:
 * - Incomplete book (missing author, title, or isbn)
 * - Invalid ISBN length (not 10 or 13 digits)
 * - OER book without oerLink
 * - Duplicate ISBN within the same requisition
 * - Duplicate title within the same requisition
 */
export async function countNeedingAttention(): Promise<number> {
  const requisitions = await prisma.textbookRequisition.findMany({
    where: { status: "PENDING", archivedAt: null },
    include: { books: true },
  });

  let count = 0;

  for (const req of requisitions) {
    const hasFlag = computeHasAttentionFlag(req.books);
    if (hasFlag) {
      count += 1;
    }
  }

  return count;
}

// ── Internal helpers ──────────────────────────────────────────────────────

interface BookForAttention {
  author: string;
  title: string;
  isbn: string;
  bookType: string;
  oerLink: string | null;
}

function computeHasAttentionFlag(books: BookForAttention[]): boolean {
  const seenIsbns = new Set<string>();
  const seenTitles = new Set<string>();

  for (const book of books) {
    // Incomplete book fields
    if (!book.author || !book.title || !book.isbn) {
      return true;
    }

    // Invalid ISBN length (must be 10 or 13 digits)
    const digitsOnly = book.isbn.replace(/[^0-9X]/gi, "");
    if (digitsOnly.length !== 10 && digitsOnly.length !== 13) {
      return true;
    }

    // OER without link
    if (book.bookType === "OER" && !book.oerLink) {
      return true;
    }

    // Duplicate ISBN
    const normalizedIsbn = digitsOnly.toLowerCase();
    if (seenIsbns.has(normalizedIsbn)) {
      return true;
    }
    seenIsbns.add(normalizedIsbn);

    // Duplicate title
    const normalizedTitle = book.title.toLowerCase().trim();
    if (seenTitles.has(normalizedTitle)) {
      return true;
    }
    seenTitles.add(normalizedTitle);
  }

  return false;
}
