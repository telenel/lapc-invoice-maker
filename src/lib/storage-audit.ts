import { prisma } from "@/lib/prisma";

const LEGACY_PATH_PREFIXES = [
  "/pdfs/",
  "pdfs/",
  "data/pdfs/",
  "/uploads/",
  "uploads/",
  "public/uploads/",
] as const;

export type LegacyStorageAudit = {
  legacyFilesystemFallbackEnabled: boolean;
  invoicePdfPaths: number;
  prismcorePaths: number;
  printQuotePdfPaths: number;
  totalLegacyReferences: number;
};

export function isLegacyFilesystemFallbackEnabled(): boolean {
  return process.env.ALLOW_LEGACY_FILESYSTEM_FALLBACK === "true";
}

export function isLegacyStoragePath(value: string | null | undefined): boolean {
  if (!value) return false;
  return LEGACY_PATH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function buildStartsWithFilters(field: "pdfPath" | "prismcorePath") {
  return LEGACY_PATH_PREFIXES.map((prefix) => ({
    [field]: { startsWith: prefix },
  }));
}

export async function getLegacyStorageAudit(): Promise<LegacyStorageAudit> {
  const [invoicePdfPaths, prismcorePaths, printQuotePdfPaths] = await Promise.all([
    prisma.invoice.count({
      where: {
        OR: buildStartsWithFilters("pdfPath"),
      },
    }),
    prisma.invoice.count({
      where: {
        OR: buildStartsWithFilters("prismcorePath"),
      },
    }),
    prisma.printQuote.count({
      where: {
        OR: LEGACY_PATH_PREFIXES.map((prefix) => ({
          pdfPath: { startsWith: prefix },
        })),
      },
    }),
  ]);

  return {
    legacyFilesystemFallbackEnabled: isLegacyFilesystemFallbackEnabled(),
    invoicePdfPaths,
    prismcorePaths,
    printQuotePdfPaths,
    totalLegacyReferences: invoicePdfPaths + prismcorePaths + printQuotePdfPaths,
  };
}
