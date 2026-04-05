import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  invoice: {
    count: vi.fn(),
  },
  printQuote: {
    count: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma,
}));

describe("storage audit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.ALLOW_LEGACY_FILESYSTEM_FALLBACK;
  });

  it("reports legacy path counts and fallback state", async () => {
    prisma.invoice.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.printQuote.count.mockResolvedValueOnce(3);

    const { getLegacyStorageAudit } = await import("@/lib/storage-audit");
    const result = await getLegacyStorageAudit();

    expect(result).toEqual({
      legacyFilesystemFallbackEnabled: false,
      invoicePdfPaths: 2,
      prismcorePaths: 1,
      printQuotePdfPaths: 3,
      totalLegacyReferences: 6,
    });
  });

  it("supports disabling filesystem fallback explicitly", async () => {
    process.env.ALLOW_LEGACY_FILESYSTEM_FALLBACK = "false";

    const { isLegacyFilesystemFallbackEnabled } = await import("@/lib/storage-audit");

    expect(isLegacyFilesystemFallbackEnabled()).toBe(false);
  });
});
