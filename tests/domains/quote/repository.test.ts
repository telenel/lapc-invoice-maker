import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { applyPublicPaymentResolution, applyPublicQuoteResponse } from "@/domains/quote/repository";

describe("quoteRepository.applyPublicPaymentResolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects payment resolution when the locked quote is no longer accepted", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "q1",
          paymentMethod: null,
          quoteStatus: "DECLINED",
        },
      ]),
      invoice: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      quoteFollowUp: {
        create: vi.fn(),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

    await expect(
      applyPublicPaymentResolution(
        "q1",
        { paymentMethod: "CHECK", paymentAccountNumber: null },
        {
          recipientEmail: "jane@example.com",
          subject: "Payment details provided for Q-1",
          metadata: { paymentMethod: "CHECK" },
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(tx.quoteFollowUp.create).not.toHaveBeenCalled();
  });
});

describe("quoteRepository.applyPublicQuoteResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects approval-time payment details when the converted invoice already has payment data", async () => {
    const tx = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([
          {
            id: "q1",
            quoteStatus: "SENT",
            paymentMethod: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "inv1",
            status: "DRAFT",
            paymentMethod: "CHECK",
          },
        ]),
      invoice: {
        update: vi.fn(),
      },
      quoteView: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

    await expect(
      applyPublicQuoteResponse("q1", {
        response: "ACCEPTED",
        acceptedAt: new Date("2026-03-31T00:00:00.000Z"),
        paymentDetails: {
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        },
        convertedInvoiceId: "inv1",
      }),
    ).rejects.toMatchObject({
      code: "PAYMENT_ALREADY_RESOLVED",
    });

    expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});
