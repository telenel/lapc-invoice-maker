import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    invoice: {
      findMany: vi.fn(),
    },
    printQuote: {
      findMany: vi.fn(),
    },
    syncRun: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { analyticsRepository } from "@/domains/analytics/repository";

describe("analyticsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.printQuote.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.syncRun.findFirst).mockResolvedValue(null as never);
  });

  it("excludes archived CopyTech invoices from operations analytics", async () => {
    await analyticsRepository.findOperationsSnapshot({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "INVOICE",
          category: "COPY_TECH",
          archivedAt: null,
        }),
      }),
    );
  });
});
