// src/domains/textbook-requisition/service.ts
import * as repository from "./repository";
import { safePublishAll } from "@/lib/sse";
import { sendEmail } from "@/lib/email";
import type {
  RequisitionResponse,
  RequisitionBookResponse,
  RequisitionNotificationResponse,
  RequisitionSubmitAck,
  RequisitionLookupItem,
  RequisitionFilters,
  CreateRequisitionInput,
  UpdateRequisitionInput,
  RequisitionStats,
  NotificationResult,
} from "./types";

// ── Types ─────────────────────────────────────────────────────────────────

type RequisitionWithRelations = NonNullable<
  Awaited<ReturnType<typeof repository.findById>>
>;

type BookRow = RequisitionWithRelations["books"][number];

// ── Attention flags ───────────────────────────────────────────────────────

function computeAttentionFlags(books: BookRow[]): string[] {
  const flags: string[] = [];
  const seenIsbns = new Map<string, number>();
  const seenTitles = new Map<string, number>();

  for (const book of books) {
    const n = book.bookNumber;

    // Incomplete book fields
    if (!book.author || !book.title || !book.isbn) {
      flags.push(`Book ${n} is incomplete`);
    }

    // Invalid ISBN length (must be 10 or 13 alphanumeric chars)
    if (book.isbn) {
      const stripped = book.isbn.replace(/[^0-9A-Za-z]/g, "");
      if (stripped.length !== 10 && stripped.length !== 13) {
        flags.push(`Book ${n} has invalid ISBN`);
      }
    }

    // OER without link
    if (book.bookType === "OER" && !book.oerLink) {
      flags.push(`Book ${n} is OER without a link`);
    }

    // Track for duplicate detection
    if (book.isbn) {
      const normalizedIsbn = book.isbn.replace(/[^0-9A-Za-z]/g, "").toLowerCase();
      if (seenIsbns.has(normalizedIsbn)) {
        flags.push(`Duplicate ISBN: ${book.isbn}`);
      } else {
        seenIsbns.set(normalizedIsbn, n);
      }
    }

    if (book.title) {
      const normalizedTitle = book.title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) {
        flags.push(`Duplicate title: ${book.title}`);
      } else {
        seenTitles.set(normalizedTitle, n);
      }
    }
  }

  return flags;
}

// ── DTO mappers ───────────────────────────────────────────────────────────

function toBookResponse(book: BookRow): RequisitionBookResponse {
  return {
    id: book.id,
    bookNumber: book.bookNumber,
    author: book.author,
    title: book.title,
    isbn: book.isbn,
    edition: book.edition,
    copyrightYear: book.copyrightYear,
    volume: book.volume,
    publisher: book.publisher,
    binding: book.binding,
    bookType: book.bookType,
    oerLink: book.oerLink,
  };
}

function toNotificationResponse(
  n: RequisitionWithRelations["notifications"][number],
): RequisitionNotificationResponse {
  return {
    id: n.id,
    type: n.type,
    recipientEmail: n.recipientEmail,
    subject: n.subject,
    success: n.success,
    sentByUserId: n.sentBy,
    sentByName:
      (n as { sender?: { name: string } | null }).sender?.name ?? null,
    sentAt: n.sentAt.toISOString(),
    errorMessage: n.errorMessage,
  };
}

function toResponse(req: RequisitionWithRelations): RequisitionResponse {
  return {
    id: req.id,
    instructorName: req.instructorName,
    phone: req.phone,
    email: req.email,
    employeeId: req.employeeId,
    department: req.department,
    course: req.course,
    sections: req.sections,
    enrollment: req.enrollment,
    term: req.term,
    reqYear: req.reqYear,
    additionalInfo: req.additionalInfo,
    staffNotes: req.staffNotes,
    status: req.status,
    source: req.source,
    createdBy: req.createdBy,
    creatorName: req.creator?.name ?? null,
    lastStatusChangedAt: req.lastStatusChangedAt
      ? req.lastStatusChangedAt.toISOString()
      : null,
    lastStatusChangedByUserId: req.lastStatusChangedBy,
    lastStatusChangedByName: req.statusChanger?.name ?? null,
    submittedAt: req.submittedAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
    books: req.books.map(toBookResponse),
    notifications: req.notifications.map(toNotificationResponse),
    attentionFlags: computeAttentionFlags(req.books),
  };
}

function toSubmitAck(req: RequisitionWithRelations): RequisitionSubmitAck {
  return {
    id: req.id,
    submittedAt: req.submittedAt.toISOString(),
    department: req.department,
    course: req.course,
    term: req.term,
    reqYear: req.reqYear,
    bookCount: req.books.length,
  };
}

function toLookupItem(
  req: Awaited<ReturnType<typeof repository.findByEmployeeId>>[number],
): RequisitionLookupItem {
  return {
    id: req.id,
    instructorName: req.instructorName,
    phone: req.phone,
    email: req.email,
    department: req.department,
    course: req.course,
    sections: req.sections,
    enrollment: req.enrollment,
    term: req.term,
    reqYear: req.reqYear,
    submittedAt: req.submittedAt.toISOString(),
    bookCount: req.books.length,
    books: req.books.map((b) => ({
      bookNumber: b.bookNumber,
      author: b.author,
      title: b.title,
      isbn: b.isbn,
      edition: b.edition,
      copyrightYear: b.copyrightYear,
      volume: b.volume,
      publisher: b.publisher,
      binding: b.binding,
      bookType: b.bookType,
      oerLink: b.oerLink,
    })),
  };
}

// ── Realtime broadcast ────────────────────────────────────────────────────

function broadcastChange(): void {
  safePublishAll({ type: "requisition-changed" });
}

// ── Email templates ───────────────────────────────────────────────────────

const BOOKSTORE_SIGNATURE =
  "Pierce College Bookstore\ntextbookorder@piercecollege.edu\n(818) 719-6420";

function buildBookList(books: BookRow[]): string {
  return books
    .map((b) => `- ${b.title} by ${b.author} (ISBN: ${b.isbn})`)
    .join("\n");
}

function buildEmailContent(
  emailType: string,
  req: RequisitionWithRelations,
): { subject: string; body: string } {
  const bookList = buildBookList(req.books);
  const courseLabel = `${req.department} ${req.course}`;

  if (emailType === "ordered") {
    return {
      subject: `Your Textbook Order Has Been Placed - ${courseLabel}`,
      body: [
        `Dear ${req.instructorName},`,
        "",
        `Your textbook order for ${courseLabel} (${req.term} ${req.reqYear}) has been placed.`,
        "",
        "Books ordered:",
        bookList,
        "",
        "We will notify you when your textbooks are available on the shelf.",
        "",
        BOOKSTORE_SIGNATURE,
      ].join("\n"),
    };
  }

  // "on-shelf"
  return {
    subject: `Your Textbooks Are Now Available - ${courseLabel}`,
    body: [
      `Dear ${req.instructorName},`,
      "",
      `The textbooks for ${courseLabel} (${req.term} ${req.reqYear}) are now available on the shelf.`,
      "",
      "Books available:",
      bookList,
      "",
      "Please remind your students to purchase their textbooks at the Pierce College Bookstore.",
      "",
      BOOKSTORE_SIGNATURE,
    ].join("\n"),
  };
}

// ── Status transition map ─────────────────────────────────────────────────

/** Valid status transitions for notification actions */
const NOTIFICATION_GUARDS: Record<string, { requiredStatus: string; nextStatus: string }> = {
  ordered: { requiredStatus: "PENDING", nextStatus: "ORDERED" },
  "on-shelf": { requiredStatus: "ORDERED", nextStatus: "ON_SHELF" },
};

// ── Service ───────────────────────────────────────────────────────────────

export const requisitionService = {
  /**
   * Paginated list of requisitions with filtering, mapped to DTOs.
   */
  async list(
    filters: RequisitionFilters & {
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    },
  ) {
    const { requisitions, total, page, pageSize } =
      await repository.findMany(filters);
    return {
      requisitions: requisitions.map((req) =>
        toResponse(req as RequisitionWithRelations),
      ),
      total,
      page,
      pageSize,
    };
  },

  /**
   * Single requisition by ID, or null if not found.
   */
  async getById(id: string): Promise<RequisitionResponse | null> {
    const req = await repository.findById(id);
    if (!req) return null;
    return toResponse(req);
  },

  /**
   * Create a requisition (admin/staff action). Sets createdBy.
   */
  async create(
    input: CreateRequisitionInput,
    userId: string,
  ): Promise<RequisitionResponse> {
    const req = await repository.create({ ...input, createdBy: userId });
    broadcastChange();
    return toResponse(req);
  },

  /**
   * Public faculty form submission. Forces source + status, returns narrow ack.
   */
  async submitPublic(
    input: CreateRequisitionInput,
  ): Promise<RequisitionSubmitAck> {
    const req = await repository.create({
      ...input,
      source: "FACULTY_FORM",
      status: "PENDING",
      createdBy: undefined,
    });
    broadcastChange();
    return toSubmitAck(req);
  },

  /**
   * Public lookup by employee ID. Returns past submissions with books.
   */
  async lookupByEmployeeId(
    employeeId: string,
  ): Promise<RequisitionLookupItem[]> {
    const results = await repository.findByEmployeeId(employeeId);
    return results.map(toLookupItem);
  },

  /**
   * Update a requisition.
   */
  async update(
    id: string,
    input: UpdateRequisitionInput,
    userId?: string,
  ): Promise<RequisitionResponse> {
    const req = await repository.update(id, input, userId);
    broadcastChange();
    return toResponse(req);
  },

  /**
   * Update only the status with audit trail.
   */
  async updateStatus(
    id: string,
    status: string,
    userId: string,
  ): Promise<RequisitionResponse> {
    const req = await repository.updateStatus(id, status, userId);
    broadcastChange();
    return toResponse(req);
  },

  /**
   * Soft delete (archive) a requisition. Record and audit trail are preserved.
   */
  async archive(id: string, userId: string): Promise<void> {
    await repository.archiveById(id, userId);
    broadcastChange();
  },

  /**
   * Send an email notification and record it. Updates status on success.
   * Returns null if the requisition is not found.
   */
  async sendNotification(
    id: string,
    emailType: string,
    userId: string,
  ): Promise<NotificationResult | null> {
    const req = await repository.findById(id);
    if (!req) return null;

    // Workflow guard: reject invalid status transitions
    const guard = NOTIFICATION_GUARDS[emailType];
    if (guard && req.status !== guard.requiredStatus) {
      return {
        requisition: toResponse(req),
        outcome: "failed" as const,
        emailSent: false,
        error: `Cannot send "${emailType}" notification: requisition status is ${req.status}, expected ${guard.requiredStatus}`,
      };
    }

    const { subject, body } = buildEmailContent(
      emailType,
      req as RequisitionWithRelations,
    );

    // ── Atomic claim ─────────────────────────────────────────────────
    // Advisory lock + append-only rows. Returns discriminated outcome.
    const claim = await repository.claimNotificationSlot({
      requisitionId: id,
      type: emailType,
      recipientEmail: req.email,
      subject,
      sentBy: userId,
    });

    if (claim.status === "already_sent") {
      return { requisition: toResponse(req), outcome: "already_sent", emailSent: true };
    }

    if (claim.status === "in_progress") {
      return {
        requisition: toResponse(req),
        outcome: "in_progress",
        emailSent: false,
        error: "Notification is already being sent by another request",
      };
    }

    if (claim.status === "stale_sending") {
      return {
        requisition: toResponse(req),
        outcome: "unknown",
        emailSent: false,
        error: "A prior send attempt crashed before confirming delivery. Check with the instructor before retrying. Use the status transition to manually advance if the email was received.",
      };
    }

    // ── Send the email ───────────────────────────────────────────────
    const emailSent = await sendEmail(req.email, subject, body);

    // ── Mark the notification with the actual result ────────────────────
    // Retry up to 3 times — critical for idempotency.
    const updateData = {
      success: emailSent,
      errorMessage: emailSent ? null : "Email delivery failed",
    };
    let auditWriteOk = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await repository.updateNotification(claim.notificationId, updateData);
        auditWriteOk = true;
        break;
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        }
      }
    }

    if (!emailSent) {
      const refreshed = await repository.findById(id);
      if (!refreshed) return null;
      broadcastChange();
      return {
        requisition: toResponse(refreshed),
        outcome: "failed",
        emailSent: false,
        error: "Email delivery failed",
      };
    }

    // ── Transition status ────────────────────────────────────────────
    let statusWriteOk = false;
    let finalRequisition: RequisitionWithRelations | null = null;
    const nextStatus = guard?.nextStatus;
    if (nextStatus) {
      try {
        finalRequisition = await repository.updateStatus(id, nextStatus, userId);
        statusWriteOk = true;
      } catch {
        finalRequisition = await repository.findById(id);
      }
    } else {
      finalRequisition = await repository.findById(id);
      statusWriteOk = true;
    }

    if (!finalRequisition) return null;
    broadcastChange();

    if (!auditWriteOk || !statusWriteOk) {
      const failures: string[] = [];
      if (!auditWriteOk) failures.push("notification audit record");
      if (!statusWriteOk) failures.push("status transition");
      return {
        requisition: toResponse(finalRequisition),
        outcome: "partial_failure",
        emailSent: true,
        error: `Email sent but failed to update: ${failures.join(", ")}. Manual status correction needed.`,
      };
    }

    return {
      requisition: toResponse(finalRequisition),
      outcome: "sent",
      emailSent: true,
    };
  },

  /**
   * Aggregate stats for the dashboard.
   */
  async getStats(): Promise<RequisitionStats> {
    const [statusCounts, needsAttention] = await Promise.all([
      repository.countByStatus(),
      repository.countNeedingAttention(),
    ]);

    return {
      ...statusCounts,
      needsAttention,
    };
  },

  /**
   * Distinct years for filter dropdowns.
   */
  async getDistinctYears(): Promise<number[]> {
    return repository.getDistinctYears();
  },
};
