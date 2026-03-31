import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
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

function makeTx() {
  return {
    $queryRaw: vi.fn(),
    invoice: {
      findMany: vi.fn(),
    },
    quoteFollowUp: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("checkAndSendPaymentFollowUps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when another process already holds the advisory lock", async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ acquired: false }]);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(tx.invoice.findMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("uses a transaction-scoped advisory lock before scanning candidates", async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    tx.invoice.findMany.mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.invoice.findMany).toHaveBeenCalledOnce();
  });

  it("uses acceptedAt instead of updatedAt when deciding whether to send the first reminder", async () => {
    const acceptedAt = new Date("2026-03-01T12:00:00.000Z");
    const updatedAt = new Date("2026-03-20T12:00:00.000Z");
    const tx = makeTx();

    tx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    tx.invoice.findMany.mockResolvedValue([
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
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendPaymentFollowUps();

    const [referenceDate, comparisonDate] = vi.mocked(businessDaysBetween).mock.calls[0] ?? [];
    expect(referenceDate).toBeInstanceOf(Date);
    expect(comparisonDate).toBeInstanceOf(Date);
    expect((referenceDate as Date).getHours()).toBe(0);
    expect((comparisonDate as Date).getHours()).toBe(0);
    expect((referenceDate as Date).getTime()).toBe(
      new Date(acceptedAt).setHours(0, 0, 0, 0),
    );
    expect((referenceDate as Date).getTime()).not.toBe(
      new Date(updatedAt).setHours(0, 0, 0, 0),
    );
  });

  it("skips reminders for quotes whose converted invoice is already finalized", async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    tx.invoice.findMany.mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(tx.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { convertedToInvoice: null },
            { convertedToInvoice: { is: { status: { not: "FINAL" } } } },
          ],
        }),
      }),
    );
  });

  it("requires a share token before emailing payment reminders", async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    tx.invoice.findMany.mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(tx.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shareToken: { not: null },
        }),
      }),
    );
  });

  it("releases the reminder claim if the email send fails", async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    vi.mocked(businessDaysBetween).mockReturnValue(7);
    tx.invoice.findMany.mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
        updatedAt: new Date("2026-03-01T12:00:00.000Z"),
        followUps: [],
        creator: { id: "u1", name: "Admin" },
      },
    ] as never);
    tx.quoteFollowUp.count.mockResolvedValue(0 as never);
    tx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    tx.quoteFollowUp.delete.mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue(false as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(tx.quoteFollowUp.create).toHaveBeenCalledOnce();
    expect(tx.quoteFollowUp.delete).toHaveBeenCalledWith({
      where: { id: "fu1" },
    });
  });
});
