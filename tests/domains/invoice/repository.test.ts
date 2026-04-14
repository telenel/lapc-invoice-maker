// tests/domains/invoice/repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    invoiceItem: {
      deleteMany: vi.fn(),
    },
    quickPickItem: {
      updateMany: vi.fn(),
    },
    savedLineItem: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import * as invoiceRepository from "@/domains/invoice/repository";
import { addDaysToDateKey, zonedDateTimeToUtc } from "@/lib/date-utils";

const mockPrisma = vi.mocked(prisma, true);

// Helper: minimal invoice row returned by Prisma
const mockInvoice = {
  id: "inv1",
  invoiceNumber: "AG-001",
  date: new Date("2026-01-15"),
  status: "DRAFT",
  type: "INVOICE",
  department: "IT",
  category: "SUPPLIES",
  accountCode: "1234",
  accountNumber: "5678",
  approvalChain: [],
  notes: "",
  totalAmount: "150.00",
  isRecurring: false,
  recurringInterval: null,
  recurringEmail: null,
  isRunning: false,
  runningTitle: null,
  pdfPath: null,
  prismcorePath: null,
  createdAt: new Date("2026-01-15T10:00:00Z"),
  updatedAt: new Date("2026-01-15T10:00:00Z"),
  staffId: "s1",
  createdBy: "u1",
  staff: { id: "s1", name: "Alice", title: "Manager", department: "IT" },
  creator: { id: "u1", name: "Bob", username: "bob" },
  items: [
    {
      id: "item1",
      description: "Laptop",
      quantity: "1",
      unitPrice: "150.00",
      extendedPrice: "150.00",
      sortOrder: 0,
      invoiceId: "inv1",
    },
  ],
  _count: { items: 1 },
};

describe("invoiceRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ── findMany ──────────────────────────────────────────────────────────────

  describe("findMany", () => {
    it("queries with type=INVOICE, default pagination and sort", async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockInvoice], 1] as never);

      const result = await invoiceRepository.findMany({});

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      const [findManyCall] = (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mock.calls[0][0];
      void findManyCall; // transaction receives array of promises, inspect args via invoice.findMany

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "INVOICE" }),
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 20,
        })
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.invoices).toHaveLength(1);
    });

    it("applies custom page and pageSize", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ page: 3, pageSize: 5 });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        })
      );
    });

    it("applies custom sortBy and sortOrder", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ sortBy: "totalAmount", sortOrder: "asc" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalAmount: "asc" },
        })
      );
    });

    it("falls back to createdAt sort for unknown sort field", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ sortBy: "hackerField", sortOrder: "asc" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "asc" },
        })
      );
    });

    it("applies status filter", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ status: "FINAL" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "FINAL" }),
        })
      );
    });

    it("treats pending-charge records as drafts when filtering drafts", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ status: "DRAFT" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["DRAFT", "PENDING_CHARGE"] },
          }),
        })
      );
    });

    it("applies department filter (case-insensitive contains)", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ department: "Engineering" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department: { contains: "Engineering", mode: "insensitive" },
          }),
        })
      );
    });

    it("applies date range filter (dateFrom and dateTo)", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ dateFrom: "2026-01-01", dateTo: "2026-01-31" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date("2026-01-01"),
              lte: new Date("2026-01-31"),
            },
          }),
        })
      );
    });

    it("applies createdAt date range filter", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ createdFrom: "2026-01-01", createdTo: "2026-01-31" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: zonedDateTimeToUtc("2026-01-01", "00:00"),
              lt: zonedDateTimeToUtc(addDaysToDateKey("2026-01-31", 1), "00:00"),
            },
          }),
        })
      );
    });

    it("applies amount range filter as strings", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ amountMin: 100, amountMax: 500 });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            totalAmount: { gte: "100", lte: "500" },
          }),
        })
      );
    });

    it("applies search filter with OR across invoice fields", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0] as never);

      await invoiceRepository.findMany({ search: "laptop" });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { invoiceNumber: { contains: "laptop", mode: "insensitive" } },
              { department: { contains: "laptop", mode: "insensitive" } },
              { staff: { name: { contains: "laptop", mode: "insensitive" } } },
              { notes: { contains: "laptop", mode: "insensitive" } },
              { items: { some: { description: { contains: "laptop", mode: "insensitive" } } } },
            ]),
          }),
        })
      );
    });
  });

  describe("countByCreator", () => {
    it("defaults creator stats to finalized invoices only", async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([] as never);

      await invoiceRepository.countByCreator();

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "INVOICE",
            status: "FINAL",
          }),
        }),
      );
    });

    it("treats legacy pending-charge invoices as drafts for creator stats when requested", async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([] as never);

      await invoiceRepository.countByCreator("DRAFT");

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "INVOICE",
            status: { in: ["DRAFT", "PENDING_CHARGE"] },
          }),
        }),
      );
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns invoice with staff, creator, and items relations", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice as never);

      const result = await invoiceRepository.findById("inv1");

      expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { id: "inv1", archivedAt: null },
        include: expect.objectContaining({
          staff: expect.any(Object),
          creator: expect.any(Object),
          items: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockInvoice);
    });

    it("returns null when invoice does not exist", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null as never);

      const result = await invoiceRepository.findById("missing");

      expect(result).toBeNull();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates invoice with calculated items and correct data shape", async () => {
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice as never);

      const calculatedItems = [
        { description: "Laptop", quantity: 1, unitPrice: 150, extendedPrice: 150, sortOrder: 0 },
      ];

      await invoiceRepository.create(
        {
          date: "2026-01-15",
          staffId: "s1",
          department: "IT",
          category: "SUPPLIES",
          accountCode: "1234",
          accountNumber: "5678",
        },
        calculatedItems,
        150,
        "u1"
      );

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffId: "s1",
            department: "IT",
            category: "SUPPLIES",
            accountCode: "1234",
            accountNumber: "5678",
            date: new Date("2026-01-15"),
            createdBy: "u1",
            totalAmount: 150,
            items: {
              create: [
                expect.objectContaining({
                  description: "Laptop",
                  quantity: 1,
                  unitPrice: 150,
                  extendedPrice: 150,
                  sortOrder: 0,
                }),
              ],
            },
          }),
        })
      );
    });

    it("normalizes empty invoiceNumber to null", async () => {
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice as never);

      await invoiceRepository.create(
        { date: "2026-01-15", staffId: "s1", department: "IT", category: "SUPPLIES", accountCode: "1234", invoiceNumber: "" },
        [],
        0,
        "u1"
      );

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invoiceNumber: null }),
        })
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("uses a transaction to delete items then update when calculatedItems provided", async () => {
      mockPrisma.$transaction.mockResolvedValue([null, mockInvoice] as never);

      const calculatedItems = [
        { description: "Monitor", quantity: 2, unitPrice: 200, extendedPrice: 400, sortOrder: 0 },
      ];

      await invoiceRepository.update("inv1", { department: "Finance" }, calculatedItems, 400);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.invoiceItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: "inv1" },
      });
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv1" },
          data: expect.objectContaining({
            department: "Finance",
            totalAmount: 400,
            items: {
              create: [
                expect.objectContaining({ description: "Monitor", extendedPrice: 400 }),
              ],
            },
          }),
        })
      );
    });

    it("updates without transaction when no calculatedItems provided", async () => {
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice as never);

      await invoiceRepository.update("inv1", { notes: "Updated note" });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv1" },
          data: expect.objectContaining({ notes: "Updated note" }),
        })
      );
    });

    it("converts date string to Date object", async () => {
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice as never);

      await invoiceRepository.update("inv1", { date: "2026-03-01" });

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ date: new Date("2026-03-01") }),
        })
      );
    });

    it("normalizes blank invoiceNumber to null during updates", async () => {
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice as never);

      await invoiceRepository.update("inv1", {
        invoiceNumber: "",
        runningTitle: "guidedpathways-Denise Robb",
      });

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceNumber: null,
            runningTitle: "guidedpathways-Denise Robb",
          }),
        })
      );
    });
  });

  // ── deleteById ────────────────────────────────────────────────────────────

  describe("deleteById", () => {
    it("hard-deletes invoice by id", async () => {
      mockPrisma.invoice.delete.mockResolvedValue(mockInvoice as never);

      await invoiceRepository.deleteById("inv1");

      expect(mockPrisma.invoice.delete).toHaveBeenCalledWith({ where: { id: "inv1" } });
    });
  });

  // ── finalize ──────────────────────────────────────────────────────────────

  describe("finalize", () => {
    it("sets status=FINAL and pdfPath", async () => {
      mockPrisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: "FINAL", pdfPath: "/pdfs/inv1.pdf" } as never);

      await invoiceRepository.finalize("inv1", "/pdfs/inv1.pdf");

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv1" },
        data: {
          status: "FINAL",
          pdfPath: "/pdfs/inv1.pdf",
          prismcorePath: null,
        },
      });
    });

    it("sets prismcorePath when provided", async () => {
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice as never);

      await invoiceRepository.finalize("inv1", "/pdfs/inv1.pdf", "/uploads/prismcore.pdf");

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv1" },
        data: {
          status: "FINAL",
          pdfPath: "/pdfs/inv1.pdf",
          prismcorePath: "/uploads/prismcore.pdf",
        },
      });
    });
  });

  // ── countAndSum ───────────────────────────────────────────────────────────

  describe("countAndSum", () => {
    it("returns total count and numeric sum", async () => {
      mockPrisma.$transaction.mockResolvedValue([
        { _sum: { totalAmount: "1250.50" } },
        5,
      ] as never);

      const result = await invoiceRepository.countAndSum({});

      expect(mockPrisma.invoice.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "INVOICE" }),
          _sum: { totalAmount: true },
        })
      );
      expect(result.total).toBe(5);
      expect(result.sumTotalAmount).toBe(1250.5);
    });

    it("handles null sum (no invoices)", async () => {
      mockPrisma.$transaction.mockResolvedValue([
        { _sum: { totalAmount: null } },
        0,
      ] as never);

      const result = await invoiceRepository.countAndSum({});

      expect(result.total).toBe(0);
      expect(result.sumTotalAmount).toBe(0);
    });
  });

  // ── incrementQuickPickUsage ───────────────────────────────────────────────

  describe("incrementQuickPickUsage", () => {
    it("calls updateMany on both quickPickItem and savedLineItem", async () => {
      mockPrisma.quickPickItem.updateMany.mockResolvedValue({ count: 1 } as never);
      mockPrisma.savedLineItem.updateMany.mockResolvedValue({ count: 1 } as never);

      await invoiceRepository.incrementQuickPickUsage("IT", ["Laptop", "Monitor"]);

      expect(mockPrisma.quickPickItem.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [{ department: "IT" }, { department: "__ALL__" }],
          description: { in: ["Laptop", "Monitor"] },
        },
        data: { usageCount: { increment: 1 } },
      });
      expect(mockPrisma.savedLineItem.updateMany).toHaveBeenCalledWith({
        where: {
          department: "IT",
          description: { in: ["Laptop", "Monitor"] },
        },
        data: { usageCount: { increment: 1 } },
      });
    });

    it("skips updates when descriptions array is empty", async () => {
      await invoiceRepository.incrementQuickPickUsage("IT", []);

      expect(mockPrisma.quickPickItem.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.savedLineItem.updateMany).not.toHaveBeenCalled();
    });
  });
});
