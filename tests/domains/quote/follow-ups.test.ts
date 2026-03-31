import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    quoteFollowUp: {
      delete: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

vi.mock("@/lib/sse", () => ({
  safePublishAll: vi.fn(),
}));

vi.mock("@/lib/date-utils", () => ({
  businessDaysBetween: vi.fn(() => 0),
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { businessDaysBetween } from "@/lib/date-utils";
import { notificationService } from "@/domains/notification/service";
import { safePublishAll } from "@/lib/sse";
import { checkAndSendPaymentFollowUps } from "@/domains/quote/follow-ups";

function makeTx() {
  return {
    $queryRaw: vi.fn(),
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    quoteFollowUp: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

describe("checkAndSendPaymentFollowUps", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(businessDaysBetween).mockReturnValue(0);
  });

  it("returns early when another process already holds the advisory lock", async () => {
    const scanTx = makeTx();
    scanTx.$queryRaw.mockResolvedValue([{ acquired: false }]);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(scanTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(scanTx.invoice.findMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("uses a transaction-scoped advisory lock before scanning candidates", async () => {
    const scanTx = makeTx();
    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    scanTx.invoice.findMany.mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(scanTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(scanTx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(scanTx.invoice.findMany).toHaveBeenCalledOnce();
  });

  it("uses acceptedAt instead of updatedAt when deciding whether to send the first reminder", async () => {
    const acceptedAt = new Date("2026-03-01T12:00:00.000Z");
    const updatedAt = new Date("2026-03-20T12:00:00.000Z");
    const scanTx = makeTx();
    const claimTx = makeTx();

    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    scanTx.invoice.findMany.mockResolvedValue([
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
    claimTx.$queryRaw.mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        quoteStatus: "ACCEPTED",
        acceptedAt,
        updatedAt,
        paymentMethod: null,
        createdBy: "u1",
      },
    ] as never);
    claimTx.invoice.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    vi.mocked(prisma.$transaction)
      .mockImplementationOnce(async (callback) => callback(scanTx as never) as never)
      .mockImplementationOnce(async (callback) => callback(claimTx as never) as never);
    vi.mocked(sendEmail).mockResolvedValue(true as never);

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
    const scanTx = makeTx();
    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    scanTx.invoice.findMany.mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(scanTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(scanTx.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          acceptedAt: { not: null },
          OR: [
            { convertedToInvoice: null },
            { convertedToInvoice: { is: { status: { not: "FINAL" } } } },
          ],
        }),
      }),
    );
  });

  it("requires a share token before emailing payment reminders", async () => {
    const scanTx = makeTx();
    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    scanTx.invoice.findMany.mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(scanTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(scanTx.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shareToken: { not: null },
        }),
      }),
    );
  });

  it("releases the reminder claim if the email send fails", async () => {
    const scanTx = makeTx();
    const claimTx = makeTx();

    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    vi.mocked(businessDaysBetween).mockReturnValue(7);
    scanTx.invoice.findMany.mockResolvedValue([
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
    claimTx.$queryRaw.mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        quoteStatus: "ACCEPTED",
        acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
        updatedAt: new Date("2026-03-01T12:00:00.000Z"),
        paymentMethod: null,
        createdBy: "u1",
      },
    ] as never);
    claimTx.invoice.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    vi.mocked(sendEmail).mockResolvedValue(false as never);
    vi.mocked(prisma.$transaction)
      .mockImplementationOnce(async (callback) => callback(scanTx as never) as never)
      .mockImplementationOnce(async (callback) => callback(claimTx as never) as never);
    vi.mocked(prisma.quoteFollowUp.delete).mockResolvedValue({} as never);

    await checkAndSendPaymentFollowUps();

    expect(claimTx.quoteFollowUp.create).toHaveBeenCalledOnce();
    expect(prisma.quoteFollowUp.delete).toHaveBeenCalledWith({
      where: { id: "fu1" },
    });
    expect(prisma.quoteFollowUp.update).not.toHaveBeenCalled();
  });

  it("skips a reminder claim when the quote is no longer accepted at lock time", async () => {
    const scanTx = makeTx();
    const claimTx = makeTx();

    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    vi.mocked(businessDaysBetween).mockReturnValue(7);
    scanTx.invoice.findMany.mockResolvedValue([
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
    claimTx.$queryRaw.mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        quoteStatus: "DECLINED",
        acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
        updatedAt: new Date("2026-03-01T12:00:00.000Z"),
        paymentMethod: null,
        createdBy: "u1",
      },
    ] as never);
    vi.mocked(prisma.$transaction)
      .mockImplementationOnce(async (callback) => callback(scanTx as never) as never)
      .mockImplementationOnce(async (callback) => callback(claimTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(claimTx.quoteFollowUp.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("notifies the converted invoice owner after a reminder send", async () => {
    const scanTx = makeTx();
    const claimTx = makeTx();

    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    vi.mocked(businessDaysBetween).mockReturnValue(7);
    scanTx.invoice.findMany.mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
        updatedAt: new Date("2026-03-01T12:00:00.000Z"),
        followUps: [],
        creator: { id: "u1", name: "Original Owner" },
      },
    ] as never);
    claimTx.$queryRaw.mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        quoteStatus: "ACCEPTED",
        acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
        updatedAt: new Date("2026-03-01T12:00:00.000Z"),
        paymentMethod: null,
        createdBy: "u1",
      },
    ] as never);
    claimTx.invoice.findFirst.mockResolvedValue({ status: "DRAFT", createdBy: "u2" } as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    vi.mocked(sendEmail).mockResolvedValue(true as never);
    vi.mocked(prisma.$transaction)
      .mockImplementationOnce(async (callback) => callback(scanTx as never) as never)
      .mockImplementationOnce(async (callback) => callback(claimTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(vi.mocked(prisma.quoteFollowUp.update)).toHaveBeenCalledWith({
      where: { id: "fu1" },
      data: { type: "PAYMENT_REMINDER" },
    });
    expect(vi.mocked(notificationService.createAndPublish)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
      }),
    );
    expect(vi.mocked(safePublishAll)).toHaveBeenCalledWith({ type: "quote-changed" });
  });
});
