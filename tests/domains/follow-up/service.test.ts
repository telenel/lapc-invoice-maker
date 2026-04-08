import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    followUp: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({
  safePublishAll: vi.fn(),
}));

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

vi.mock("@/domains/follow-up/repository", () => ({
  followUpRepository: {
    findActiveSeriesByInvoiceId: vi.fn(),
    findByShareToken: vi.fn(),
    getLatestFollowUpForInvoice: vi.fn(),
    getFollowUpBadgesForInvoices: vi.fn(),
    createClaimRow: vi.fn(),
    promoteClaimRow: vi.fn(),
    deleteClaimRow: vi.fn(),
    markSeriesStatus: vi.fn(),
    countAttempts: vi.fn(),
    deleteStaleClaimsForSeries: vi.fn(),
    findFreshClaimForSeries: vi.fn(),
  },
}));

import { followUpService } from "@/domains/follow-up/service";
import { followUpRepository } from "@/domains/follow-up/repository";
import { sendEmail } from "@/lib/email";

describe("followUpService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("initiateSingle", () => {
    const mockInvoice = {
      id: "inv-1",
      invoiceNumber: "INV-0042",
      quoteNumber: null,
      type: "INVOICE",
      accountNumber: "",
      description: "Office Supplies",
      totalAmount: { toNumber: () => 250 },
      staffId: "staff-1",
      createdBy: "user-1",
      staff: { email: "jane@piercecollege.edu", name: "Jane Smith" },
      creator: { id: "user-1", name: "John Doe" },
    };

    it("should reject if invoice already has an account number", async () => {
      const result = await followUpService.initiateSingle(
        { ...mockInvoice, accountNumber: "12345" },
        "user-1",
        false,
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("already has an account number");
    });

    it("should reject if no staff member is linked", async () => {
      const result = await followUpService.initiateSingle(
        { ...mockInvoice, staffId: null, staff: null },
        "user-1",
        false,
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("No recipient");
    });

    it("should reject if an active series already exists", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue({ alreadyActive: true });
      const result = await followUpService.initiateSingle(mockInvoice, "user-1", false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("already has an active");
    });

    it("should delete claim and return error if email fails", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        claim: { id: "claim-1" },
        seriesId: "series-1",
        subject: "Test",
        html: "<p>test</p>",
        docNumber: "INV-0042",
      });
      (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      (prisma.followUp.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await followUpService.initiateSingle(mockInvoice, "user-1", false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("Email send failed");
    });

    it("should promote claim and return success on successful send", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        claim: { id: "claim-1" },
        seriesId: "series-1",
        subject: "Test",
        html: "<p>test</p>",
        docNumber: "INV-0042",
      });
      (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await followUpService.initiateSingle(mockInvoice, "user-1", false);
      expect(result.status).toBe("success");
      expect(result.seriesId).toBe("series-1");
    });
  });

  describe("submitAccountNumber", () => {
    it("should return error for invalid token", async () => {
      (followUpRepository.findByShareToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await followUpService.submitAccountNumber("bad-token", "12345");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });

    it("should return alreadyResolved if series is COMPLETED", async () => {
      (followUpRepository.findByShareToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        seriesId: "s1",
        seriesStatus: "COMPLETED",
        metadata: { attempt: 1 },
        invoice: { id: "inv-1", accountNumber: "123", type: "INVOICE", createdBy: "u1", invoiceNumber: "INV-1", quoteNumber: null, creator: { name: "A" } },
      });
      const result = await followUpService.submitAccountNumber("token", "12345");
      expect(result.alreadyResolved).toBe(true);
    });

    it("should reject empty account number", async () => {
      (followUpRepository.findByShareToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        seriesId: "s1",
        seriesStatus: "ACTIVE",
        metadata: { attempt: 1 },
        invoice: { id: "inv-1", accountNumber: "", type: "INVOICE", createdBy: "u1", invoiceNumber: "INV-1", quoteNumber: null, creator: { name: "A" } },
      });
      const result = await followUpService.submitAccountNumber("token", "   ");
      expect(result.success).toBe(false);
    });
  });

  describe("getBadgeState", () => {
    it("should return null when no follow-up exists", async () => {
      (followUpRepository.getLatestFollowUpForInvoice as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await followUpService.getBadgeState("inv-1");
      expect(result).toBeNull();
    });

    it("should return badge state for active series", async () => {
      (followUpRepository.getLatestFollowUpForInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({
        seriesStatus: "ACTIVE",
        maxAttempts: 5,
        metadata: { attempt: 3 },
      });
      const result = await followUpService.getBadgeState("inv-1");
      expect(result).toEqual({ seriesStatus: "ACTIVE", currentAttempt: 3, maxAttempts: 5 });
    });

    it("should return null for COMPLETED series", async () => {
      (followUpRepository.getLatestFollowUpForInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({
        seriesStatus: "COMPLETED",
        maxAttempts: 5,
        metadata: { attempt: 2 },
      });
      const result = await followUpService.getBadgeState("inv-1");
      expect(result).toBeNull();
    });
  });
});
