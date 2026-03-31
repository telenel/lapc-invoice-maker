import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    invoice: {
      findMany: vi.fn(),
    },
    quoteFollowUp: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    generatePdf: vi.fn(),
  },
}));

vi.mock("@/lib/date-utils", () => ({
  businessDaysBetween: vi.fn(() => 0),
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { businessDaysBetween } from "@/lib/date-utils";
import { checkAndSendPaymentFollowUps } from "@/domains/quote/follow-ups";

describe("checkAndSendPaymentFollowUps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when another process already holds the advisory lock", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ acquired: false }] as never);

    await checkAndSendPaymentFollowUps();

    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("releases the advisory lock after processing", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ acquired: true }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);

    await checkAndSendPaymentFollowUps();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.invoice.findMany).toHaveBeenCalledOnce();
  });

  it("uses acceptedAt instead of updatedAt when deciding whether to send the first reminder", async () => {
    const acceptedAt = new Date("2026-03-01T12:00:00.000Z");
    const updatedAt = new Date("2026-03-20T12:00:00.000Z");

    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ acquired: true }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        acceptedAt,
        updatedAt,
        followUps: [],
        creator: { id: "u1", name: "Admin" },
      },
    ] as never);

    await checkAndSendPaymentFollowUps();

    expect(businessDaysBetween).toHaveBeenCalledWith(acceptedAt, expect.any(Date));
    expect(businessDaysBetween).not.toHaveBeenCalledWith(updatedAt, expect.any(Date));
  });
});
