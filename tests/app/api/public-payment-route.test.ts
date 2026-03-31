import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    quoteFollowUp: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sse", () => ({
  safePublishAll: vi.fn(),
}));

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { safePublishAll } from "@/lib/sse";
import { POST } from "@/app/api/quotes/public/[token]/payment/route";

describe("POST /api/quotes/public/[token]/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the converted invoice alongside the quote", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      recipientEmail: "jane@example.com",
      createdBy: "u1",
      paymentMethod: null,
      convertedToInvoice: { id: "inv1" },
    } as never);
    vi.mocked(prisma.invoice.update)
      .mockReturnValueOnce("quote-update" as never)
      .mockReturnValueOnce("invoice-update" as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
    vi.mocked(prisma.quoteFollowUp.create).mockResolvedValue({} as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-12345",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.invoice.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "q1" },
        data: expect.objectContaining({
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "inv1" },
        data: expect.objectContaining({
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        }),
      }),
    );
    expect(safePublishAll).toHaveBeenCalledWith({ type: "invoice-changed" });
  });

  it("rejects attempts to overwrite already-provided payment details", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      recipientEmail: "jane@example.com",
      createdBy: "u1",
      paymentMethod: "CHECK",
      convertedToInvoice: { id: "inv1" },
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-99999",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.quoteFollowUp.create).not.toHaveBeenCalled();
  });
});
