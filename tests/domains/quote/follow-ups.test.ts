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
    },
    quoteFollowUp: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

function mockTransactions(...txs: ReturnType<typeof makeTx>[]) {
  const txMock = vi.mocked(prisma.$transaction);
  for (const tx of txs) {
    txMock.mockImplementationOnce(async (callback) => callback(tx as never) as never);
  }
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
    const refreshTx = makeTx();
    const confirmTx = makeTx();

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
    claimTx.$queryRaw
      .mockResolvedValueOnce([
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
      ] as never)
      .mockResolvedValueOnce([] as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    refreshTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt,
          paymentMethod: null,
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    confirmTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt,
          paymentMethod: null,
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    mockTransactions(scanTx, claimTx, refreshTx, confirmTx);
    vi.mocked(sendEmail).mockResolvedValue(true as never);

    await checkAndSendPaymentFollowUps();

    const [referenceDate, comparisonDate] = vi.mocked(businessDaysBetween).mock.calls[0] ?? [];
    expect(referenceDate).toBeInstanceOf(Date);
    expect(comparisonDate).toBeInstanceOf(Date);
    expect(referenceDate).toBe(acceptedAt);
    expect(referenceDate).not.toBe(updatedAt);
    expect((referenceDate as Date).toISOString().slice(0, 10)).toBe(
      acceptedAt.toISOString().slice(0, 10),
    );
  });

  it("falls back to updatedAt for legacy accepted quotes without acceptedAt", async () => {
    const updatedAt = new Date("2026-03-20T12:00:00.000Z");
    const scanTx = makeTx();
    const claimTx = makeTx();
    const confirmTx = makeTx();

    scanTx.$queryRaw.mockResolvedValue([{ acquired: true }]);
    vi.mocked(businessDaysBetween).mockReturnValue(7);
    scanTx.invoice.findMany.mockResolvedValue([
      {
        id: "q1",
        quoteNumber: "Q-1",
        recipientName: "Jane",
        recipientEmail: "jane@example.com",
        shareToken: "token",
        acceptedAt: null,
        updatedAt,
        followUps: [],
        creator: { id: "u1", name: "Admin" },
      },
    ] as never);
    claimTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt: null,
          updatedAt,
          paymentMethod: null,
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    vi.mocked(prisma.quoteFollowUp.delete).mockResolvedValue({} as never);
    confirmTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt: null,
          updatedAt,
          paymentMethod: null,
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    mockTransactions(scanTx, claimTx, confirmTx);
    vi.mocked(sendEmail).mockResolvedValue(true as never);

    await checkAndSendPaymentFollowUps();

    const [referenceDate] = vi.mocked(businessDaysBetween).mock.calls[0] ?? [];
    expect(referenceDate).toBe(updatedAt);
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
          quoteStatus: "ACCEPTED",
          OR: [
            { convertedToInvoice: null },
            { convertedToInvoice: { is: { status: { not: "FINAL" }, paymentMethod: null } } },
          ],
        }),
      }),
    );
  });

  it("skips reminders for quotes whose converted invoice already has payment details", async () => {
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
    claimTx.$queryRaw
      .mockResolvedValueOnce([
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
      ] as never)
      .mockResolvedValueOnce([
        {
          id: "inv1",
          status: "DRAFT",
          paymentMethod: "ACCOUNT_NUMBER",
          createdBy: "u2",
        },
      ] as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    vi.mocked(prisma.$transaction)
      .mockImplementationOnce(async (callback) => callback(scanTx as never) as never)
      .mockImplementationOnce(async (callback) => callback(claimTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(claimTx.quoteFollowUp.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(claimTx.quoteFollowUp.update).not.toHaveBeenCalled();
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

  it("promotes the reminder claim before emailing, even if the send fails", async () => {
    const scanTx = makeTx();
    const claimTx = makeTx();
    const refreshTx = makeTx();

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
    claimTx.$queryRaw
      .mockResolvedValueOnce([
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
      ] as never)
      .mockResolvedValueOnce([] as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    refreshTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
          paymentMethod: null,
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(sendEmail).mockResolvedValue(false as never);
    vi.mocked(prisma.quoteFollowUp.delete).mockResolvedValue({} as never);
    mockTransactions(scanTx, claimTx, refreshTx);

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
    claimTx.$queryRaw.mockResolvedValueOnce([
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
    const refreshTx = makeTx();
    const confirmTx = makeTx();

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
    claimTx.$queryRaw
      .mockResolvedValueOnce([
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
      ] as never)
      .mockResolvedValueOnce([{ id: "inv1", status: "DRAFT", createdBy: "u2" }] as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    refreshTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
          paymentMethod: null,
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    confirmTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
          paymentMethod: null,
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(sendEmail).mockResolvedValue(true as never);
    mockTransactions(scanTx, claimTx, refreshTx, confirmTx);

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

  it("skips reminder claims when the converted invoice finalizes before the claim commits", async () => {
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
    claimTx.$queryRaw
      .mockResolvedValueOnce([
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
      ] as never)
      .mockResolvedValueOnce([{ id: "inv1", status: "FINAL", createdBy: "u2" }] as never);
    vi.mocked(prisma.$transaction)
      .mockImplementationOnce(async (callback) => callback(scanTx as never) as never)
      .mockImplementationOnce(async (callback) => callback(claimTx as never) as never);

    await checkAndSendPaymentFollowUps();

    expect(claimTx.quoteFollowUp.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips a reminder when payment details resolve after the claim is created", async () => {
    const scanTx = makeTx();
    const claimTx = makeTx();
    const refreshTx = makeTx();

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
    claimTx.$queryRaw
      .mockResolvedValueOnce([
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
      ] as never)
      .mockResolvedValueOnce([] as never);
    claimTx.quoteFollowUp.findFirst.mockResolvedValue(null as never);
    claimTx.quoteFollowUp.count.mockResolvedValue(0 as never);
    claimTx.quoteFollowUp.create.mockResolvedValue({ id: "fu1" } as never);
    refreshTx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "q1",
          quoteNumber: "Q-1",
          recipientName: "Jane",
          recipientEmail: "jane@example.com",
          shareToken: "token",
          quoteStatus: "ACCEPTED",
          acceptedAt: new Date("2026-03-01T12:00:00.000Z"),
          paymentMethod: "CHECK",
          createdBy: "u1",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    mockTransactions(scanTx, claimTx, refreshTx);
    vi.mocked(prisma.quoteFollowUp.delete).mockResolvedValue({} as never);

    await checkAndSendPaymentFollowUps();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.quoteFollowUp.delete).toHaveBeenCalledWith({
      where: { id: "fu1" },
    });
    expect(prisma.quoteFollowUp.update).not.toHaveBeenCalled();
  });
});
