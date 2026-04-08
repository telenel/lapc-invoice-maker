// tests/domains/follow-up/account-follow-ups.test.ts
process.env.NEXTAUTH_URL = "http://localhost:3000";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
      })
    ),
    followUp: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    invoice: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/sse", () => ({ safePublishAll: vi.fn() }));
vi.mock("@/lib/date-utils", () => ({ businessDaysBetween: vi.fn() }));
vi.mock("@/domains/notification/service", () => ({
  notificationService: { createAndPublish: vi.fn() },
}));
vi.mock("@/domains/follow-up/repository", () => ({
  followUpRepository: {
    findAllActiveSeries: vi.fn(),
    countAttempts: vi.fn(),
    markSeriesStatus: vi.fn(),
    deleteStaleClaimsForSeries: vi.fn(),
    findFreshClaimForSeries: vi.fn(),
    createClaimRow: vi.fn(),
    promoteClaimRow: vi.fn(),
    deleteClaimRow: vi.fn(),
  },
}));

import { checkAndSendAccountFollowUps } from "@/domains/follow-up/account-follow-ups";
import { followUpRepository } from "@/domains/follow-up/repository";
import { businessDaysBetween } from "@/lib/date-utils";
import { sendEmail } from "@/lib/email";

describe("checkAndSendAccountFollowUps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should skip series where invoice already has account number", async () => {
    (followUpRepository.findAllActiveSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        seriesId: "s1",
        invoice: { id: "inv-1", accountNumber: "12345", type: "INVOICE", createdBy: "u1", staff: { email: "a@b.com", name: "A" }, creator: { id: "u1", name: "B" } },
        metadata: { attempt: 1 },
        sentAt: new Date(),
        maxAttempts: 5,
      },
    ]);

    await checkAndSendAccountFollowUps();
    expect(followUpRepository.markSeriesStatus).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should skip if fewer than 5 business days since last send", async () => {
    (followUpRepository.findAllActiveSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        seriesId: "s1",
        invoice: { id: "inv-1", accountNumber: "", type: "INVOICE", createdBy: "u1", staff: { email: "a@b.com", name: "A" }, creator: { id: "u1", name: "B" } },
        metadata: { attempt: 1 },
        sentAt: new Date(),
        maxAttempts: 5,
      },
    ]);
    (businessDaysBetween as ReturnType<typeof vi.fn>).mockReturnValue(3);

    await checkAndSendAccountFollowUps();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should send email and promote claim on successful send", async () => {
    (followUpRepository.findAllActiveSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        seriesId: "s1",
        invoice: {
          id: "inv-1", accountNumber: "", invoiceNumber: "INV-0042", quoteNumber: null,
          type: "INVOICE", description: "Supplies", totalAmount: 100,
          createdBy: "u1", staffId: "staff-1",
          staff: { email: "a@b.com", name: "A" }, creator: { id: "u1", name: "B" },
        },
        metadata: { attempt: 1 },
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        maxAttempts: 5,
        shareToken: "tok-1",
      },
    ]);
    (businessDaysBetween as ReturnType<typeof vi.fn>).mockReturnValue(7);
    (followUpRepository.countAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (followUpRepository.findFreshClaimForSeries as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (followUpRepository.createClaimRow as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "claim-1" });
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    // Mock prisma.followUp.findFirst to return the initiator's shareToken
    const { prisma } = await import("@/lib/prisma");
    (prisma.followUp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ shareToken: "tok-1" });

    await checkAndSendAccountFollowUps();
    expect(sendEmail).toHaveBeenCalled();
    expect(followUpRepository.promoteClaimRow).toHaveBeenCalledWith("claim-1");
  });
});
