import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { adminRepository } from "@/domains/admin/repository";

const mockPrisma = vi.mocked(prisma, true);

describe("adminRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("batchUpdateQuoteStatus", () => {
    it("stamps acceptedAt when bulk-accepting quotes", async () => {
      mockPrisma.invoice.updateMany
        .mockResolvedValueOnce({ count: 2 } as never)
        .mockResolvedValueOnce({ count: 1 } as never);

      const result = await adminRepository.batchUpdateQuoteStatus(["q1", "q2"], "ACCEPTED");

      expect(result).toEqual({ count: 3 });
      expect(mockPrisma.invoice.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: { in: ["q1", "q2"] },
          type: "QUOTE",
          acceptedAt: { not: null },
        },
        data: { quoteStatus: "ACCEPTED" },
      });
      expect(mockPrisma.invoice.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: { in: ["q1", "q2"] },
          type: "QUOTE",
          acceptedAt: null,
        },
        data: {
          quoteStatus: "ACCEPTED",
          acceptedAt: expect.any(Date),
        },
      });
    });

    it("does not set acceptedAt for non-accepted bulk status changes", async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 4 } as never);

      const result = await adminRepository.batchUpdateQuoteStatus(["q1"], "REVISED");

      expect(result).toEqual({ count: 4 });
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledOnce();
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["q1"] },
          type: "QUOTE",
        },
        data: { quoteStatus: "REVISED" },
      });
    });
  });
});
