import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { applyPublicPaymentResolution } from "@/domains/quote/repository";

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
