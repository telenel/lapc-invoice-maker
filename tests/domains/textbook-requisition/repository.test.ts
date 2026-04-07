// tests/domains/textbook-requisition/repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    textbookRequisition: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    requisitionBook: {
      deleteMany: vi.fn(),
    },
    requisitionNotification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import * as repo from "@/domains/textbook-requisition/repository";

const mockPrisma = vi.mocked(prisma, true);

// Helper: minimal requisition row returned by Prisma
const mockRequisition = {
  id: "req1",
  instructorName: "Dr. Smith",
  phone: "818-555-1234",
  email: "smith@piercecollege.edu",
  department: "English",
  course: "ENG 101",
  sections: "01, 02",
  enrollment: 40,
  term: "Fall",
  reqYear: 2026,
  additionalInfo: null,
  staffNotes: null,
  status: "PENDING",
  source: "FACULTY_FORM",
  createdBy: "u1",
  lastStatusChangedAt: null,
  lastStatusChangedBy: null,
  submittedAt: new Date("2026-03-01T10:00:00Z"),
  updatedAt: new Date("2026-03-01T10:00:00Z"),
  books: [
    {
      id: "b1",
      requisitionId: "req1",
      bookNumber: 1,
      author: "Hemingway",
      title: "The Old Man and the Sea",
      isbn: "9780684801223",
      edition: null,
      copyrightYear: null,
      volume: null,
      publisher: "Scribner",
      binding: null,
      bookType: "PHYSICAL",
      oerLink: null,
    },
  ],
  notifications: [],
  creator: { id: "u1", name: "Alice" },
  statusChanger: null,
};

describe("textbookRequisitionRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ── findMany ──────────────────────────────────────────────────────────────

  describe("findMany", () => {
    it("queries with default pagination (page 1, size 20) via $transaction", async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockRequisition], 1] as never);

      const result = await repo.findMany({});

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submittedAt: "desc" },
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({
        requisitions: [mockRequisition],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it("applies status filter", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await repo.findMany({ status: "ORDERED" });

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ORDERED" }),
        }),
      );
    });

    it("applies term filter", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await repo.findMany({ term: "Fall" });

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ term: "Fall" }),
        }),
      );
    });

    it("applies year filter", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await repo.findMany({ year: 2026 });

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reqYear: 2026 }),
        }),
      );
    });

    it("applies search filter with OR across requisition fields and nested books", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await repo.findMany({ search: "hemingway" });

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { instructorName: { contains: "hemingway", mode: "insensitive" } },
              { email: { contains: "hemingway", mode: "insensitive" } },
              { department: { contains: "hemingway", mode: "insensitive" } },
              { course: { contains: "hemingway", mode: "insensitive" } },
              { sections: { contains: "hemingway", mode: "insensitive" } },
              { phone: { contains: "hemingway", mode: "insensitive" } },
              { additionalInfo: { contains: "hemingway", mode: "insensitive" } },
              { staffNotes: { contains: "hemingway", mode: "insensitive" } },
              {
                books: {
                  some: { author: { contains: "hemingway", mode: "insensitive" } },
                },
              },
              {
                books: {
                  some: { title: { contains: "hemingway", mode: "insensitive" } },
                },
              },
              {
                books: {
                  some: { isbn: { contains: "hemingway", mode: "insensitive" } },
                },
              },
              {
                books: {
                  some: { publisher: { contains: "hemingway", mode: "insensitive" } },
                },
              },
            ]),
          }),
        }),
      );
    });

    it("applies custom page and pageSize", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await repo.findMany({ page: 3, pageSize: 10 });

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it("falls back to submittedAt sort for unknown sort field", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await repo.findMany({ sortBy: "hackerField", sortOrder: "asc" });

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submittedAt: "asc" },
        }),
      );
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns requisition with books, notifications, creator, and statusChanger", async () => {
      mockPrisma.textbookRequisition.findFirst.mockResolvedValue(mockRequisition as never);

      const result = await repo.findById("req1");

      expect(mockPrisma.textbookRequisition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req1", archivedAt: null },
          include: expect.objectContaining({
            books: expect.any(Object),
          }),
        }),
      );
      expect(result).toEqual(mockRequisition);
    });

    it("returns null when requisition does not exist", async () => {
      mockPrisma.textbookRequisition.findFirst.mockResolvedValue(null as never);

      const result = await repo.findById("missing");

      expect(result).toBeNull();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates requisition with nested books", async () => {
      mockPrisma.textbookRequisition.create.mockResolvedValue(mockRequisition as never);

      await repo.create({
        instructorName: "Dr. Smith",
        phone: "818-555-1234",
        email: "smith@piercecollege.edu",
        department: "English",
        course: "ENG 101",
        sections: "01, 02",
        enrollment: 40,
        term: "Fall",
        reqYear: 2026,
        books: [
          {
            bookNumber: 1,
            author: "Hemingway",
            title: "The Old Man and the Sea",
            isbn: "9780684801223",
            publisher: "Scribner",
          },
        ],
      });

      expect(mockPrisma.textbookRequisition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instructorName: "Dr. Smith",
            department: "English",
            books: {
              create: [
                expect.objectContaining({
                  bookNumber: 1,
                  author: "Hemingway",
                  title: "The Old Man and the Sea",
                  isbn: "9780684801223",
                  publisher: "Scribner",
                }),
              ],
            },
          }),
          include: expect.objectContaining({
            books: expect.any(Object),
            notifications: expect.any(Object),
            creator: expect.any(Object),
          }),
        }),
      );
    });

    it("sets optional book fields to null when not provided", async () => {
      mockPrisma.textbookRequisition.create.mockResolvedValue(mockRequisition as never);

      await repo.create({
        instructorName: "Dr. Smith",
        phone: "818-555-1234",
        email: "smith@piercecollege.edu",
        department: "English",
        course: "ENG 101",
        sections: "01",
        enrollment: 30,
        term: "Spring",
        reqYear: 2026,
        books: [
          {
            bookNumber: 1,
            author: "Orwell",
            title: "1984",
            isbn: "9780451524935",
          },
        ],
      });

      const callArgs = mockPrisma.textbookRequisition.create.mock.calls[0][0] as {
        data: { books: { create: Array<Record<string, unknown>> } };
      };
      const bookCreate = callArgs.data.books.create[0];
      expect(bookCreate.edition).toBeNull();
      expect(bookCreate.copyrightYear).toBeNull();
      expect(bookCreate.volume).toBeNull();
      expect(bookCreate.publisher).toBeNull();
      expect(bookCreate.binding).toBeNull();
      expect(bookCreate.bookType).toBe("PHYSICAL");
      expect(bookCreate.oerLink).toBeNull();
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("sets status, lastStatusChangedAt, and lastStatusChangedBy", async () => {
      mockPrisma.textbookRequisition.update.mockResolvedValue({
        ...mockRequisition,
        status: "ORDERED",
      } as never);

      await repo.updateStatus("req1", "ORDERED", "u2");

      expect(mockPrisma.textbookRequisition.update).toHaveBeenCalledWith({
        where: { id: "req1" },
        data: {
          status: "ORDERED",
          lastStatusChangedAt: expect.any(Date),
          lastStatusChangedBy: "u2",
        },
        include: expect.objectContaining({
          books: expect.any(Object),
          notifications: expect.any(Object),
          creator: expect.any(Object),
          statusChanger: expect.any(Object),
        }),
      });
    });
  });

  // ── archiveById ──────────────────────────────────────────────────────────

  describe("archiveById", () => {
    it("soft-deletes requisition by setting archivedAt", async () => {
      mockPrisma.textbookRequisition.update.mockResolvedValue(mockRequisition as never);

      await repo.archiveById("req1", "user-1");

      expect(mockPrisma.textbookRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req1" },
          data: expect.objectContaining({
            archivedBy: "user-1",
          }),
        }),
      );
    });
  });

  // ── countByStatus ─────────────────────────────────────────────────────────

  describe("countByStatus", () => {
    it("returns counts for pending, ordered, onShelf, and total", async () => {
      mockPrisma.$transaction.mockResolvedValue([5, 3, 2, 10] as never);

      const result = await repo.countByStatus();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.textbookRequisition.count).toHaveBeenCalledTimes(4);
      expect(result).toEqual({
        pending: 5,
        ordered: 3,
        onShelf: 2,
        total: 10,
      });
    });
  });

  // ── getDistinctYears ──────────────────────────────────────────────────────

  describe("getDistinctYears", () => {
    it("returns sorted years descending", async () => {
      mockPrisma.textbookRequisition.findMany.mockResolvedValue([
        { reqYear: 2026 },
        { reqYear: 2025 },
        { reqYear: 2024 },
      ] as never);

      const result = await repo.getDistinctYears();

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith({
        select: { reqYear: true },
        distinct: ["reqYear"],
        orderBy: { reqYear: "desc" },
      });
      expect(result).toEqual([2026, 2025, 2024]);
    });
  });

  // ── createNotification ────────────────────────────────────────────────────

  describe("createNotification", () => {
    it("creates a notification record", async () => {
      const notificationData = {
        requisitionId: "req1",
        type: "STATUS_CHANGE",
        recipientEmail: "smith@piercecollege.edu",
        subject: "Your requisition status changed",
        success: true,
        sentBy: "u1",
      };

      mockPrisma.requisitionNotification.create.mockResolvedValue({
        id: "n1",
        ...notificationData,
        sentAt: new Date(),
        errorMessage: null,
      } as never);

      await repo.createNotification(notificationData);

      expect(mockPrisma.requisitionNotification.create).toHaveBeenCalledWith({
        data: notificationData,
      });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("uses transaction to delete books then update when books provided", async () => {
      mockPrisma.$transaction.mockResolvedValue([null, mockRequisition] as never);

      await repo.update("req1", {
        instructorName: "Dr. Jones",
        books: [
          {
            bookNumber: 1,
            author: "Fitzgerald",
            title: "The Great Gatsby",
            isbn: "9780743273565",
          },
        ],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.requisitionBook.deleteMany).toHaveBeenCalledWith({
        where: { requisitionId: "req1" },
      });
      expect(mockPrisma.textbookRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req1" },
          data: expect.objectContaining({
            instructorName: "Dr. Jones",
            books: {
              create: [
                expect.objectContaining({
                  bookNumber: 1,
                  author: "Fitzgerald",
                  title: "The Great Gatsby",
                  isbn: "9780743273565",
                }),
              ],
            },
          }),
        }),
      );
    });

    it("updates without transaction when no books provided", async () => {
      mockPrisma.textbookRequisition.update.mockResolvedValue(mockRequisition as never);

      await repo.update("req1", { staffNotes: "Follow up needed" });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.textbookRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req1" },
          data: expect.objectContaining({ staffNotes: "Follow up needed" }),
          include: expect.objectContaining({
            books: expect.any(Object),
          }),
        }),
      );
    });

    it("sets status audit fields when status changes through the general update path", async () => {
      mockPrisma.textbookRequisition.update.mockResolvedValue({
        ...mockRequisition,
        status: "ORDERED",
      } as never);

      await repo.update("req1", { status: "ORDERED" }, "u2");

      expect(mockPrisma.textbookRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req1" },
          data: expect.objectContaining({
            status: "ORDERED",
            lastStatusChangedAt: expect.any(Date),
            lastStatusChangedBy: "u2",
          }),
        }),
      );
    });
  });

  // ── countNeedingAttention ─────────────────────────────────────────────────

  describe("countNeedingAttention", () => {
    it("counts requisitions with attention flags", async () => {
      mockPrisma.textbookRequisition.findMany.mockResolvedValue([
        {
          ...mockRequisition,
          id: "req1",
          books: [
            {
              bookNumber: 1,
              author: "",
              title: "Some Book",
              isbn: "9780684801223",
              bookType: "PHYSICAL",
              oerLink: null,
            },
          ],
        },
        {
          ...mockRequisition,
          id: "req2",
          books: [
            {
              bookNumber: 1,
              author: "Good Author",
              title: "Good Title",
              isbn: "9780684801223",
              bookType: "PHYSICAL",
              oerLink: null,
            },
          ],
        },
      ] as never);

      const count = await repo.countNeedingAttention();

      expect(mockPrisma.textbookRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING", archivedAt: null },
          include: expect.objectContaining({ books: true }),
        }),
      );
      // req1 has incomplete book (empty author), req2 is clean
      expect(count).toBe(1);
    });

    it("flags OER books without oerLink", async () => {
      mockPrisma.textbookRequisition.findMany.mockResolvedValue([
        {
          ...mockRequisition,
          id: "req1",
          books: [
            {
              bookNumber: 1,
              author: "Author",
              title: "OER Book",
              isbn: "9780684801223",
              bookType: "OER",
              oerLink: null,
            },
          ],
        },
      ] as never);

      const count = await repo.countNeedingAttention();
      expect(count).toBe(1);
    });

    it("flags invalid ISBN length", async () => {
      mockPrisma.textbookRequisition.findMany.mockResolvedValue([
        {
          ...mockRequisition,
          id: "req1",
          books: [
            {
              bookNumber: 1,
              author: "Author",
              title: "Book",
              isbn: "12345",
              bookType: "PHYSICAL",
              oerLink: null,
            },
          ],
        },
      ] as never);

      const count = await repo.countNeedingAttention();
      expect(count).toBe(1);
    });

    it("flags duplicate ISBNs within a requisition", async () => {
      mockPrisma.textbookRequisition.findMany.mockResolvedValue([
        {
          ...mockRequisition,
          id: "req1",
          books: [
            {
              bookNumber: 1,
              author: "Author A",
              title: "Book A",
              isbn: "9780684801223",
              bookType: "PHYSICAL",
              oerLink: null,
            },
            {
              bookNumber: 2,
              author: "Author B",
              title: "Book B",
              isbn: "9780684801223",
              bookType: "PHYSICAL",
              oerLink: null,
            },
          ],
        },
      ] as never);

      const count = await repo.countNeedingAttention();
      expect(count).toBe(1);
    });

    it("flags duplicate titles within a requisition", async () => {
      mockPrisma.textbookRequisition.findMany.mockResolvedValue([
        {
          ...mockRequisition,
          id: "req1",
          books: [
            {
              bookNumber: 1,
              author: "Author A",
              title: "Same Title",
              isbn: "9780684801223",
              bookType: "PHYSICAL",
              oerLink: null,
            },
            {
              bookNumber: 2,
              author: "Author B",
              title: "Same Title",
              isbn: "9780451524935",
              bookType: "PHYSICAL",
              oerLink: null,
            },
          ],
        },
      ] as never);

      const count = await repo.countNeedingAttention();
      expect(count).toBe(1);
    });

    it("returns 0 when all requisitions are clean", async () => {
      mockPrisma.textbookRequisition.findMany.mockResolvedValue([
        {
          ...mockRequisition,
          id: "req1",
          books: [
            {
              bookNumber: 1,
              author: "Good Author",
              title: "Good Title",
              isbn: "9780684801223",
              bookType: "PHYSICAL",
              oerLink: null,
            },
          ],
        },
      ] as never);

      const count = await repo.countNeedingAttention();
      expect(count).toBe(0);
    });
  });
});
