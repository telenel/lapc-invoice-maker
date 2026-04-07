// tests/domains/textbook-requisition/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/textbook-requisition/repository", () => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  archiveById: vi.fn(),
  countByStatus: vi.fn(),
  getDistinctYears: vi.fn(),
  createNotification: vi.fn(),
  updateNotification: vi.fn(),
  claimNotificationSlot: vi.fn(),
  countNeedingAttention: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({ safePublishAll: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
}));

import * as repository from "@/domains/textbook-requisition/repository";
import { safePublishAll } from "@/lib/sse";
import { sendEmail } from "@/lib/email";
import { requisitionService } from "@/domains/textbook-requisition/service";

const mockRepo = vi.mocked(repository, true);
const mockPublishAll = vi.mocked(safePublishAll);
const mockSendEmail = vi.mocked(sendEmail);

// ── Shared mock data ────────────────────────────────────────────────────────

const mockRequisition = {
  id: "req-1",
  instructorName: "Dr. Smith",
  phone: "(818) 555-1234",
  email: "smith@piercecollege.edu",
  department: "Computer Science",
  course: "CS 101",
  sections: "01",
  enrollment: 35,
  term: "Fall",
  reqYear: 2026,
  additionalInfo: null,
  staffNotes: null,
  status: "PENDING" as const,
  source: "FACULTY_FORM" as const,
  createdBy: "user-1",
  lastStatusChangedAt: null,
  lastStatusChangedBy: null,
  submittedAt: new Date("2026-04-06T10:00:00Z"),
  updatedAt: new Date("2026-04-06T10:00:00Z"),
  creator: { id: "user-1", name: "Admin User" },
  statusChanger: null,
  books: [
    {
      id: "book-1",
      requisitionId: "req-1",
      bookNumber: 1,
      author: "Author",
      title: "Title",
      isbn: "9781234567890",
      edition: null,
      copyrightYear: null,
      volume: null,
      publisher: null,
      binding: null,
      bookType: "PHYSICAL" as const,
      oerLink: null,
    },
  ],
  notifications: [],
};

// ── beforeEach ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── list() ──────────────────────────────────────────────────────────────────

describe("requisitionService.list", () => {
  it("maps DB records to DTOs with ISO date strings and computed attention flags", async () => {
    mockRepo.findMany.mockResolvedValue({
      requisitions: [mockRequisition],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const result = await requisitionService.list({});

    expect(result.requisitions).toHaveLength(1);
    const dto = result.requisitions[0];
    expect(dto.submittedAt).toBe("2026-04-06T10:00:00.000Z");
    expect(dto.updatedAt).toBe("2026-04-06T10:00:00.000Z");
    expect(dto.creatorName).toBe("Admin User");
    expect(dto.attentionFlags).toEqual([]);
    expect(dto.books).toHaveLength(1);
    expect(dto.books[0].isbn).toBe("9781234567890");
  });

  it("returns empty attentionFlags for valid requisitions", async () => {
    mockRepo.findMany.mockResolvedValue({
      requisitions: [mockRequisition],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const result = await requisitionService.list({});
    expect(result.requisitions[0].attentionFlags).toEqual([]);
  });
});

// ── getById() ───────────────────────────────────────────────────────────────

describe("requisitionService.getById", () => {
  it("returns null for missing records", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await requisitionService.getById("nonexistent");
    expect(result).toBeNull();
  });

  it("returns mapped DTO with creatorName resolved from creator relation", async () => {
    mockRepo.findById.mockResolvedValue(mockRequisition);

    const result = await requisitionService.getById("req-1");
    expect(result).not.toBeNull();
    expect(result!.creatorName).toBe("Admin User");
    expect(result!.id).toBe("req-1");
    expect(result!.submittedAt).toBe("2026-04-06T10:00:00.000Z");
  });
});

// ── create() ────────────────────────────────────────────────────────────────

describe("requisitionService.create", () => {
  it("broadcasts requisition-changed realtime event, sets createdBy", async () => {
    mockRepo.create.mockResolvedValue(mockRequisition);

    const input = {
      instructorName: "Dr. Smith",
      phone: "(818) 555-1234",
      email: "smith@piercecollege.edu",
      department: "Computer Science",
      course: "CS 101",
      sections: "01",
      enrollment: 35,
      term: "Fall",
      reqYear: 2026,
      books: [
        {
          bookNumber: 1,
          author: "Author",
          title: "Title",
          isbn: "9781234567890",
        },
      ],
    };

    const result = await requisitionService.create(input, "user-1");

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "user-1" }),
    );
    expect(mockPublishAll).toHaveBeenCalledWith({
      type: "requisition-changed",
    });
    expect(result.id).toBe("req-1");
  });
});

// ── submitPublic() ──────────────────────────────────────────────────────────

describe("requisitionService.submitPublic", () => {
  it("returns narrow RequisitionSubmitAck, forces source FACULTY_FORM + status PENDING", async () => {
    mockRepo.create.mockResolvedValue(mockRequisition);

    const input = {
      instructorName: "Dr. Smith",
      phone: "(818) 555-1234",
      email: "smith@piercecollege.edu",
      department: "Computer Science",
      course: "CS 101",
      sections: "01",
      enrollment: 35,
      term: "Fall",
      reqYear: 2026,
      books: [
        {
          bookNumber: 1,
          author: "Author",
          title: "Title",
          isbn: "9781234567890",
        },
      ],
    };

    const ack = await requisitionService.submitPublic(input);

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "FACULTY_FORM",
        status: "PENDING",
      }),
    );
    expect(ack).toEqual({
      id: "req-1",
      submittedAt: "2026-04-06T10:00:00.000Z",
      department: "Computer Science",
      course: "CS 101",
      term: "Fall",
      reqYear: 2026,
      bookCount: 1,
    });
    expect(mockPublishAll).toHaveBeenCalledWith({
      type: "requisition-changed",
    });
  });
});

// ── update() ────────────────────────────────────────────────────────────────

describe("requisitionService.update", () => {
  it("passes the optional userId through and broadcasts realtime event", async () => {
    mockRepo.update.mockResolvedValue(mockRequisition);

    await requisitionService.update("req-1", { enrollment: 40 }, "user-2");

    expect(mockRepo.update).toHaveBeenCalledWith(
      "req-1",
      { enrollment: 40 },
      "user-2",
    );
    expect(mockPublishAll).toHaveBeenCalledWith({
      type: "requisition-changed",
    });
  });
});

// ── updateStatus() ──────────────────────────────────────────────────────────

describe("requisitionService.updateStatus", () => {
  it("passes userId for audit trail, broadcasts", async () => {
    mockRepo.updateStatus.mockResolvedValue({
      ...mockRequisition,
      status: "ORDERED" as const,
      lastStatusChangedAt: new Date("2026-04-06T12:00:00Z"),
      lastStatusChangedBy: "user-2",
      statusChanger: { id: "user-2", name: "Staff Member" },
    });

    const result = await requisitionService.updateStatus(
      "req-1",
      "ORDERED",
      "user-2",
    );

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "req-1",
      "ORDERED",
      "user-2",
    );
    expect(mockPublishAll).toHaveBeenCalledWith({
      type: "requisition-changed",
    });
    expect(result.status).toBe("ORDERED");
  });
});

// ── delete() ────────────────────────────────────────────────────────────────

describe("requisitionService.archive", () => {
  it("soft-deletes and broadcasts realtime event", async () => {
    mockRepo.archiveById.mockResolvedValue(mockRequisition as never);

    await requisitionService.archive("req-1", "user-1");

    expect(mockRepo.archiveById).toHaveBeenCalledWith("req-1", "user-1");
    expect(mockPublishAll).toHaveBeenCalledWith({
      type: "requisition-changed",
    });
  });
});

// ── sendNotification() ──────────────────────────────────────────────────────

describe("requisitionService.sendNotification", () => {
  it("happy path: claims slot, sends email, updates record, transitions status", async () => {
    mockRepo.findById.mockResolvedValue(mockRequisition);
    mockRepo.claimNotificationSlot.mockResolvedValue({ status: "claimed", notificationId: "notif-1" });
    mockSendEmail.mockResolvedValue(true);
    mockRepo.updateNotification.mockResolvedValue(undefined as never);
    mockRepo.updateStatus.mockResolvedValue({
      ...mockRequisition,
      status: "ORDERED" as const,
      lastStatusChangedAt: new Date("2026-04-06T12:00:00Z"),
      lastStatusChangedBy: "user-1",
      statusChanger: { id: "user-1", name: "Admin User" },
    });

    const result = await requisitionService.sendNotification("req-1", "ordered", "user-1");

    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("sent");
    expect(result!.emailSent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockRepo.claimNotificationSlot).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateNotification).toHaveBeenCalledWith("notif-1", {
      success: true,
      errorMessage: null,
    });
    expect(mockRepo.updateStatus).toHaveBeenCalled();
  });

  it("idempotent: already_sent — returns emailSent true, no resend", async () => {
    mockRepo.findById.mockResolvedValue(mockRequisition);
    mockRepo.claimNotificationSlot.mockResolvedValue({ status: "already_sent" });

    const result = await requisitionService.sendNotification("req-1", "ordered", "user-1");

    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("already_sent");
    expect(result!.emailSent).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("concurrent: in_progress — returns emailSent false with error, no send", async () => {
    mockRepo.findById.mockResolvedValue(mockRequisition);
    mockRepo.claimNotificationSlot.mockResolvedValue({ status: "in_progress" });

    const result = await requisitionService.sendNotification("req-1", "ordered", "user-1");

    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("in_progress");
    expect(result!.emailSent).toBe(false);
    expect(result!.error).toContain("already being sent");
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockRepo.updateNotification).not.toHaveBeenCalled();
  });

  it("retry after failed send: claim reuses existing record", async () => {
    mockRepo.findById.mockResolvedValue(mockRequisition);
    // Claim reclaimed a prior failed record
    mockRepo.claimNotificationSlot.mockResolvedValue({ status: "claimed", notificationId: "notif-failed" });
    mockSendEmail.mockResolvedValue(true);
    mockRepo.updateNotification.mockResolvedValue(undefined as never);
    mockRepo.updateStatus.mockResolvedValue({
      ...mockRequisition,
      status: "ORDERED" as const,
      lastStatusChangedAt: new Date("2026-04-06T12:00:00Z"),
      lastStatusChangedBy: "user-1",
      statusChanger: { id: "user-1", name: "Admin User" },
    });

    const result = await requisitionService.sendNotification("req-1", "ordered", "user-1");

    expect(result!.outcome).toBe("sent");
    expect(result!.emailSent).toBe(true);
    expect(mockRepo.updateNotification).toHaveBeenCalledWith("notif-failed", {
      success: true,
      errorMessage: null,
    });
  });

  it("post-send DB failure still returns emailSent: true (no retry trigger)", async () => {
    mockRepo.findById.mockResolvedValue(mockRequisition);
    mockRepo.claimNotificationSlot.mockResolvedValue({ status: "claimed", notificationId: "notif-1" });
    mockSendEmail.mockResolvedValue(true);
    // Both post-send DB writes fail
    mockRepo.updateNotification.mockRejectedValue(new Error("DB down"));
    mockRepo.updateStatus.mockRejectedValue(new Error("DB down"));

    const result = await requisitionService.sendNotification("req-1", "ordered", "user-1");

    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("partial_failure");
    expect(result!.emailSent).toBe(true);
    expect(result!.error).toContain("failed to update");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("on email failure: creates notification, updates to failure, does NOT change status, returns emailSent: false", async () => {
    mockRepo.findById
      .mockResolvedValueOnce(mockRequisition)
      .mockResolvedValueOnce({
        ...mockRequisition,
        notifications: [
          {
            id: "note-1",
            requisitionId: "req-1",
            type: "ordered",
            recipientEmail: "smith@piercecollege.edu",
            subject: "Your Textbook Order Has Been Placed - Computer Science CS 101",
            success: false,
            sentBy: "user-1",
            sender: { id: "user-1", name: "Admin User" },
            sentAt: new Date("2026-04-06T12:00:00Z"),
            errorMessage: "Email delivery failed",
          },
        ],
      } as typeof mockRequisition);
    mockRepo.claimNotificationSlot.mockResolvedValue({ status: "claimed", notificationId: "notif-2" });
    mockSendEmail.mockResolvedValue(false);
    mockRepo.updateNotification.mockResolvedValue(undefined as never);

    const result = await requisitionService.sendNotification(
      "req-1",
      "ordered",
      "user-1",
    );

    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("failed");
    expect(result!.emailSent).toBe(false);
    expect(result!.error).toBe("Email delivery failed");
    expect(mockRepo.updateNotification).toHaveBeenCalledWith("notif-2", {
      success: false,
      errorMessage: "Email delivery failed",
    });
    expect(mockPublishAll).toHaveBeenCalledWith({
      type: "requisition-changed",
    });
    // Status should NOT be updated on failure
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    expect(result!.requisition.notifications).toHaveLength(1);
    expect(result!.requisition.notifications[0]).toMatchObject({
      success: false,
      sentByName: "Admin User",
      errorMessage: "Email delivery failed",
    });
  });

  it("returns null when requisition not found", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await requisitionService.sendNotification(
      "nonexistent",
      "ordered",
      "user-1",
    );

    expect(result).toBeNull();
  });
});

// ── getStats() ──────────────────────────────────────────────────────────────

describe("requisitionService.getStats", () => {
  it("returns proper stats including needsAttention count", async () => {
    mockRepo.countByStatus.mockResolvedValue({
      total: 10,
      pending: 5,
      ordered: 3,
      onShelf: 2,
    });
    mockRepo.countNeedingAttention.mockResolvedValue(2);

    const stats = await requisitionService.getStats();

    expect(stats).toEqual({
      total: 10,
      pending: 5,
      ordered: 3,
      onShelf: 2,
      needsAttention: 2,
    });
  });
});

// ── computeAttentionFlags ───────────────────────────────────────────────────

describe("attention flags", () => {
  it("missing author/title/isbn → 'Book N is incomplete'", async () => {
    const req = {
      ...mockRequisition,
      books: [
        {
          ...mockRequisition.books[0],
          author: "",
          bookNumber: 1,
        },
      ],
    };
    mockRepo.findById.mockResolvedValue(req);

    const result = await requisitionService.getById("req-1");
    expect(result!.attentionFlags).toContain("Book 1 is incomplete");
  });

  it("missing title → 'Book N is incomplete'", async () => {
    const req = {
      ...mockRequisition,
      books: [
        {
          ...mockRequisition.books[0],
          title: "",
          bookNumber: 2,
        },
      ],
    };
    mockRepo.findById.mockResolvedValue(req);

    const result = await requisitionService.getById("req-1");
    expect(result!.attentionFlags).toContain("Book 2 is incomplete");
  });

  it("missing isbn → 'Book N is incomplete'", async () => {
    const req = {
      ...mockRequisition,
      books: [
        {
          ...mockRequisition.books[0],
          isbn: "",
          bookNumber: 3,
        },
      ],
    };
    mockRepo.findById.mockResolvedValue(req);

    const result = await requisitionService.getById("req-1");
    expect(result!.attentionFlags).toContain("Book 3 is incomplete");
  });

  it("invalid ISBN length → 'Book N has invalid ISBN'", async () => {
    const req = {
      ...mockRequisition,
      books: [
        {
          ...mockRequisition.books[0],
          isbn: "12345",
          bookNumber: 1,
        },
      ],
    };
    mockRepo.findById.mockResolvedValue(req);

    const result = await requisitionService.getById("req-1");
    expect(result!.attentionFlags).toContain("Book 1 has invalid ISBN");
  });

  it("OER without link → 'Book N is OER without a link'", async () => {
    const req = {
      ...mockRequisition,
      books: [
        {
          ...mockRequisition.books[0],
          bookType: "OER" as const,
          oerLink: null,
          bookNumber: 1,
        },
      ],
    };
    mockRepo.findById.mockResolvedValue(req);

    const result = await requisitionService.getById("req-1");
    expect(result!.attentionFlags).toContain("Book 1 is OER without a link");
  });

  it("duplicate ISBN → 'Duplicate ISBN: ...'", async () => {
    const req = {
      ...mockRequisition,
      books: [
        {
          ...mockRequisition.books[0],
          id: "book-1",
          bookNumber: 1,
          isbn: "9781234567890",
        },
        {
          ...mockRequisition.books[0],
          id: "book-2",
          bookNumber: 2,
          isbn: "9781234567890",
        },
      ],
    };
    mockRepo.findById.mockResolvedValue(req);

    const result = await requisitionService.getById("req-1");
    expect(result!.attentionFlags).toContain("Duplicate ISBN: 9781234567890");
  });

  it("duplicate title → 'Duplicate title: ...'", async () => {
    const req = {
      ...mockRequisition,
      books: [
        {
          ...mockRequisition.books[0],
          id: "book-1",
          bookNumber: 1,
          title: "Same Title",
          isbn: "9781234567890",
        },
        {
          ...mockRequisition.books[0],
          id: "book-2",
          bookNumber: 2,
          title: "Same Title",
          isbn: "9780987654321",
        },
      ],
    };
    mockRepo.findById.mockResolvedValue(req);

    const result = await requisitionService.getById("req-1");
    expect(result!.attentionFlags).toContain("Duplicate title: Same Title");
  });
});
