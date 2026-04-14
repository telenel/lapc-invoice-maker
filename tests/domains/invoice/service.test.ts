// tests/domains/invoice/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/invoice/repository", () => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archiveById: vi.fn(),
  restoreById: vi.fn(),
  finalize: vi.fn(),
  countAndSum: vi.fn(),
  incrementQuickPickUsage: vi.fn(),
  countByCreator: vi.fn(),
}));

vi.mock("@/domains/pdf/service", () => ({
  pdfService: {
    generateInvoice: vi.fn(),
    mergePrismCore: vi.fn(),
    deletePdfFiles: vi.fn(),
  },
}));

vi.mock("@/domains/staff/service", () => ({
  staffService: {
    upsertAccountNumber: vi.fn(),
    recordSignerHistory: vi.fn(),
  },
}));

import * as invoiceRepository from "@/domains/invoice/repository";
import { pdfService } from "@/domains/pdf/service";
import { staffService } from "@/domains/staff/service";
import { invoiceService } from "@/domains/invoice/service";

const mockRepo = vi.mocked(invoiceRepository, true);
const mockPdfService = vi.mocked(pdfService, true);
const mockStaffService = vi.mocked(staffService, true);

// ── Shared mock data ─────────────────────────────────────────────────────────

const mockInvoiceRow = {
  id: "inv1",
  invoiceNumber: "AG-001",
  date: new Date("2026-01-15T00:00:00Z"),
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
  archivedAt: null,
  archivedBy: null,
  createdAt: new Date("2026-01-15T10:00:00Z"),
  updatedAt: new Date("2026-01-15T10:00:00Z"),
  staffId: "s1",
  createdBy: "u1",
  staff: {
    id: "s1",
    name: "Alice",
    title: "Manager",
    department: "IT",
    extension: "x100",
    email: "alice@test.com",
  },
  contact: null,
  creator: { id: "u1", name: "Bob", username: "bob" },
  archiver: null,
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
};

describe("invoiceService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("maps invoices to DTOs with ISO string dates and numeric totals", async () => {
      mockRepo.findMany.mockResolvedValue({
        invoices: [mockInvoiceRow],
        total: 1,
        page: 1,
        pageSize: 20,
      } as never);

      const result = await invoiceService.list({});

      expect(mockRepo.findMany).toHaveBeenCalledWith({});
      expect(result.total).toBe(1);
      expect(result.invoices).toHaveLength(1);

      const inv = result.invoices[0];
      expect(inv.id).toBe("inv1");
      expect(inv.date).toBe(new Date("2026-01-15T00:00:00Z").toISOString());
      expect(inv.createdAt).toBe(new Date("2026-01-15T10:00:00Z").toISOString());
      expect(inv.totalAmount).toBe(150);
      expect(typeof inv.totalAmount).toBe("number");
    });

    it("maps items with Number() coercion on Decimal strings", async () => {
      mockRepo.findMany.mockResolvedValue({
        invoices: [mockInvoiceRow],
        total: 1,
        page: 1,
        pageSize: 20,
      } as never);

      const result = await invoiceService.list({});
      const item = result.invoices[0].items[0];

      expect(item.quantity).toBe(1);
      expect(item.unitPrice).toBe(150);
      expect(item.extendedPrice).toBe(150);
      expect(typeof item.quantity).toBe("number");
      expect(typeof item.unitPrice).toBe("number");
    });

    it("maps staff fields including extension and email", async () => {
      mockRepo.findMany.mockResolvedValue({
        invoices: [mockInvoiceRow],
        total: 1,
        page: 1,
        pageSize: 20,
      } as never);

      const result = await invoiceService.list({});
      const staff = result.invoices[0].staff;

      expect(staff).not.toBeNull();
      expect(staff!.id).toBe("s1");
      expect(staff!.name).toBe("Alice");
      expect(staff!.extension).toBe("x100");
      expect(staff!.email).toBe("alice@test.com");
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns null when invoice does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null as never);

      const result = await invoiceService.getById("missing");

      expect(result).toBeNull();
    });

    it("maps invoice to InvoiceResponse DTO", async () => {
      mockRepo.findById.mockResolvedValue(mockInvoiceRow as never);

      const result = await invoiceService.getById("inv1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("inv1");
      expect(result!.invoiceNumber).toBe("AG-001");
      expect(result!.totalAmount).toBe(150);
      expect(result!.creatorId).toBe("u1");
      expect(result!.creatorName).toBe("Bob");
    });

    it("coerces null accountNumber to empty string", async () => {
      mockRepo.findById.mockResolvedValue({ ...mockInvoiceRow, accountNumber: null } as never);

      const result = await invoiceService.getById("inv1");

      expect(result!.accountNumber).toBe("");
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("calls calculateLineItems, calculateTotal, then repository.create", async () => {
      mockRepo.create.mockResolvedValue(mockInvoiceRow as never);
      mockStaffService.upsertAccountNumber.mockResolvedValue(undefined as never);

      const input = {
        date: "2026-01-15",
        staffId: "s1",
        department: "IT",
        category: "SUPPLIES",
        accountCode: "1234",
        items: [{ description: "Laptop", quantity: 1, unitPrice: 150 }],
      };

      const result = await invoiceService.create(input, "u1");

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-01-15",
          staffId: "s1",
          department: "IT",
          accountCode: "1234",
        }),
        [expect.objectContaining({ description: "Laptop", quantity: 1, unitPrice: 150, extendedPrice: 150 })],
        150,
        "u1"
      );
      expect(result.id).toBe("inv1");
    });

    it("does not throw if upsertAccountNumber fails (non-critical)", async () => {
      mockRepo.create.mockResolvedValue(mockInvoiceRow as never);
      mockStaffService.upsertAccountNumber.mockRejectedValue(new Error("DB error"));

      const input = {
        date: "2026-01-15",
        staffId: "s1",
        department: "IT",
        category: "SUPPLIES",
        accountCode: "1234",
        accountNumber: "9999",
        items: [],
      };

      await expect(invoiceService.create(input, "u1")).resolves.toBeDefined();
    });

    it("skips upsertAccountNumber when accountNumber is not provided", async () => {
      mockRepo.create.mockResolvedValue(mockInvoiceRow as never);

      const input = {
        date: "2026-01-15",
        staffId: "s1",
        department: "IT",
        category: "SUPPLIES",
        accountCode: "1234",
        items: [],
      };

      await invoiceService.create(input, "u1");

      // upsertAccountNumber should not be called synchronously; it's fire-and-forget
      // We can verify the mock was never called with a staffId (meaning the branch was skipped)
      expect(mockStaffService.upsertAccountNumber).not.toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("throws FORBIDDEN when invoice is FINAL", async () => {
      mockRepo.findById.mockResolvedValue({ ...mockInvoiceRow, status: "FINAL" } as never);

      await expect(
        invoiceService.update("inv1", { notes: "Try to update" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws NOT_FOUND when invoice does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null as never);

      await expect(
        invoiceService.update("missing", { notes: "x" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("recalculates items and total when items array is provided", async () => {
      mockRepo.findById.mockResolvedValue(mockInvoiceRow as never);
      mockRepo.update.mockResolvedValue(mockInvoiceRow as never);

      const newItems = [{ description: "Monitor", quantity: 2, unitPrice: 300 }];
      await invoiceService.update("inv1", { items: newItems });

      expect(mockRepo.update).toHaveBeenCalledWith(
        "inv1",
        expect.not.objectContaining({ items: expect.anything() }),
        [expect.objectContaining({ description: "Monitor", extendedPrice: 600 })],
        600
      );
    });

    it("updates without recalculating when no items provided", async () => {
      mockRepo.findById.mockResolvedValue(mockInvoiceRow as never);
      mockRepo.update.mockResolvedValue(mockInvoiceRow as never);

      await invoiceService.update("inv1", { notes: "New note" });

      // When no items are provided, repository.update is called with only id + data (no calculatedItems/totalAmount)
      expect(mockRepo.update).toHaveBeenCalledOnce();
      expect(mockRepo.update).toHaveBeenCalledWith("inv1", expect.objectContaining({ notes: "New note" }));
      const callArgs = mockRepo.update.mock.calls[0];
      expect(callArgs[2]).toBeUndefined(); // no calculatedItems arg
    });
  });

  // ── archive / restore ─────────────────────────────────────────────────────

  describe("archive", () => {
    it("throws NOT_FOUND when invoice does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null as never);

      await expect(invoiceService.archive("missing", "u1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("archives finalized invoices instead of deleting files", async () => {
      const finalInvoice = { ...mockInvoiceRow, status: "FINAL", pdfPath: "/pdfs/inv1.pdf", prismcorePath: "/uploads/pc.pdf" };
      mockRepo.findById.mockResolvedValue(finalInvoice as never);
      mockRepo.archiveById.mockResolvedValue(finalInvoice as never);

      await invoiceService.archive("inv1", "admin-1");

      expect(mockPdfService.deletePdfFiles).not.toHaveBeenCalled();
      expect(mockRepo.archiveById).toHaveBeenCalledWith("inv1", "admin-1");
    });

    it("restores an archived invoice", async () => {
      mockRepo.restoreById.mockResolvedValue(mockInvoiceRow as never);

      const result = await invoiceService.restore("inv1");

      expect(mockRepo.restoreById).toHaveBeenCalledWith("inv1");
      expect(result.archivedAt).toBeNull();
    });
  });

  // ── finalize ──────────────────────────────────────────────────────────────

  describe("finalize", () => {
    const invoiceWithNumber = {
      ...mockInvoiceRow,
      invoiceNumber: "AG-001",
      status: "DRAFT",
    };

    it("throws NOT_FOUND when invoice does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null as never);

      await expect(
        invoiceService.finalize("missing", {})
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws VALIDATION when invoiceNumber is missing", async () => {
      mockRepo.findById.mockResolvedValue({ ...mockInvoiceRow, invoiceNumber: null } as never);

      await expect(
        invoiceService.finalize("inv1", {})
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("parses signature 'Name, Title' into {name, title}", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      await invoiceService.finalize("inv1", {
        signatures: { line1: "John Smith, Director of Finance" },
      });

      expect(mockPdfService.generateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          coverSheet: expect.objectContaining({
            signatures: expect.arrayContaining([
              { name: "John Smith", title: "Director of Finance" },
            ]),
          }),
        }),
        "invoices/inv1/AG-001.pdf"
      );
    });

    it("parses signature without title (no comma)", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      await invoiceService.finalize("inv1", {
        signatures: { line1: "John Smith" },
      });

      expect(mockPdfService.generateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          coverSheet: expect.objectContaining({
            signatures: expect.arrayContaining([{ name: "John Smith" }]),
          }),
        }),
        "invoices/inv1/AG-001.pdf"
      );
    });

    it("calls pdfService.generateInvoice with correct coverSheet and idp data", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      const result = await invoiceService.finalize("inv1", {
        signatures: { line1: "Alice, Manager" },
        contactName: "Bob",
        contactExtension: "x200",
        semesterYearDept: "SP26-IT",
      });

      expect(mockPdfService.generateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          coverSheet: expect.objectContaining({
            invoiceNumber: "AG-001",
            semesterYearDept: "SP26-IT",
          }),
          idp: expect.objectContaining({
            contactName: "Bob",
            contactPhone: "x200",
            documentNumber: "AG-001",
          }),
        }),
        "invoices/inv1/AG-001.pdf"
      );
      expect(result).toEqual({ pdfPath: "/pdfs/inv1.pdf" });
    });

    it("keeps the selected requestor separate from the department approver", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      await invoiceService.finalize("inv1", {
        signatures: {
          line1: "Alice Approver, Dean",
          line2: "Brian Backup, Director",
        },
        contactName: "Riley Requestor",
        contactExtension: "x321",
      });

      expect(mockPdfService.generateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          idp: expect.objectContaining({
            approverName: "Alice Approver",
            contactName: "Riley Requestor",
            contactPhone: "x321",
          }),
        }),
        "invoices/inv1/AG-001.pdf"
      );
    });

    it("calls pdfService.mergePrismCore when prismcorePath is provided", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockPdfService.mergePrismCore.mockResolvedValue(undefined as never);
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      await invoiceService.finalize("inv1", { prismcorePath: "/uploads/pc.pdf" });

      expect(mockPdfService.mergePrismCore).toHaveBeenCalledWith("/pdfs/inv1.pdf", "/uploads/pc.pdf");
    });

    it("does not call mergePrismCore when prismcorePath is not provided", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      await invoiceService.finalize("inv1", {});

      expect(mockPdfService.mergePrismCore).not.toHaveBeenCalled();
    });

    it("calls repository.finalize with pdfPath and prismcorePath", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      await invoiceService.finalize("inv1", { prismcorePath: "/uploads/pc.pdf" });

      expect(mockRepo.finalize).toHaveBeenCalledWith(
        "inv1",
        "/pdfs/inv1.pdf",
        "/uploads/pc.pdf",
        expect.objectContaining({
          signatures: {
            line1: undefined,
            line2: undefined,
            line3: undefined,
          },
          signatureStaffIds: {
            line1: undefined,
            line2: undefined,
            line3: undefined,
          },
          semesterYearDept: undefined,
          contactName: undefined,
          contactExtension: undefined,
        }),
      );
    });

    it("uses invoice.staff.name as contactName when not provided", async () => {
      mockRepo.findById.mockResolvedValue(invoiceWithNumber as never);
      mockPdfService.generateInvoice.mockResolvedValue("/pdfs/inv1.pdf");
      mockRepo.finalize.mockResolvedValue(invoiceWithNumber as never);

      await invoiceService.finalize("inv1", {});

      expect(mockPdfService.generateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          idp: expect.objectContaining({ contactName: "Alice" }),
        }),
        "invoices/inv1/AG-001.pdf"
      );
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("delegates to repository.countAndSum", async () => {
      mockRepo.countAndSum.mockResolvedValue({ total: 10, sumTotalAmount: 5000 } as never);

      const result = await invoiceService.getStats({ status: "FINAL" });

      expect(mockRepo.countAndSum).toHaveBeenCalledWith({ status: "FINAL" });
      expect(result.total).toBe(10);
      expect(result.sumTotalAmount).toBe(5000);
    });
  });
});
