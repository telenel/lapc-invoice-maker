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

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
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
});
