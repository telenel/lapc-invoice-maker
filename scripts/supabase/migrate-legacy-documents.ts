#!/usr/bin/env tsx
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/prisma";
import {
  invoicePdfObjectKey,
  printQuotePdfObjectKey,
  quotePdfObjectKey,
  uploadDocument,
  uploadPdfObjectKey,
} from "../../src/lib/document-storage";

const LEGACY_PDFS_DIR = path.resolve(process.cwd(), "data/pdfs");
const LEGACY_UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads");

function isLegacyInvoicePdfPath(value: string | null): value is string {
  return !!value && (
    value.startsWith("/pdfs/") ||
    value.startsWith("pdfs/") ||
    value.startsWith("data/pdfs/")
  );
}

function isLegacyUploadPath(value: string | null): value is string {
  return !!value && (
    value.startsWith("/uploads/") ||
    value.startsWith("public/uploads/")
  );
}

function resolveLegacyPath(storedPath: string): string {
  const normalized = storedPath.replace(/^\/+/, "");

  if (normalized.startsWith("public/uploads/")) {
    return path.resolve(process.cwd(), normalized);
  }

  if (normalized.startsWith("uploads/")) {
    return path.join(LEGACY_UPLOADS_DIR, normalized.slice("uploads/".length));
  }

  if (normalized.startsWith("data/pdfs/")) {
    return path.resolve(process.cwd(), normalized);
  }

  if (normalized.startsWith("pdfs/")) {
    return path.join(LEGACY_PDFS_DIR, normalized.slice("pdfs/".length));
  }

  throw new Error(`Unsupported legacy path: ${storedPath}`);
}

function legacyUploadObjectKey(recordId: string, storedPath: string): string {
  return uploadPdfObjectKey(`legacy-${recordId}-${path.basename(storedPath)}`);
}

function invoiceObjectKey(invoice: {
  id: string;
  type: "INVOICE" | "QUOTE";
  invoiceNumber: string | null;
  quoteNumber: string | null;
}) {
  if (invoice.type === "QUOTE") {
    return quotePdfObjectKey(
      invoice.id,
      invoice.quoteNumber ?? invoice.invoiceNumber ?? invoice.id,
    );
  }

  return invoicePdfObjectKey(
    invoice.id,
    invoice.invoiceNumber ?? invoice.quoteNumber ?? invoice.id,
  );
}

async function uploadLegacyFile(localPath: string, objectKey: string) {
  const buffer = await readFile(localPath);
  await uploadDocument(objectKey, buffer, "application/pdf");
}

async function migrateInvoices(dryRun: boolean) {
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { pdfPath: { not: null } },
        { prismcorePath: { not: null } },
      ],
    },
    select: {
      id: true,
      type: true,
      invoiceNumber: true,
      quoteNumber: true,
      pdfPath: true,
      prismcorePath: true,
    },
  });

  let migrated = 0;
  const warnings: string[] = [];

  for (const invoice of invoices) {
    const updates: { pdfPath?: string; prismcorePath?: string } = {};

    if (isLegacyInvoicePdfPath(invoice.pdfPath)) {
      try {
        const localPath = resolveLegacyPath(invoice.pdfPath);
        const objectKey = invoiceObjectKey(invoice);
        if (!dryRun) {
          await uploadLegacyFile(localPath, objectKey);
        }
        updates.pdfPath = objectKey;
      } catch (error) {
        warnings.push(
          `invoice ${invoice.id}: failed to migrate pdfPath ${invoice.pdfPath} (${error instanceof Error ? error.message : "unknown error"})`,
        );
      }
    }

    if (isLegacyUploadPath(invoice.prismcorePath)) {
      try {
        const localPath = resolveLegacyPath(invoice.prismcorePath);
        const objectKey = legacyUploadObjectKey(invoice.id, invoice.prismcorePath);
        if (!dryRun) {
          await uploadLegacyFile(localPath, objectKey);
        }
        updates.prismcorePath = objectKey;
      } catch (error) {
        warnings.push(
          `invoice ${invoice.id}: failed to migrate prismcorePath ${invoice.prismcorePath} (${error instanceof Error ? error.message : "unknown error"})`,
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      continue;
    }

    if (!dryRun) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: updates,
      });
    }

    migrated += 1;
  }

  return { migrated, warnings };
}

async function migratePrintQuotes(dryRun: boolean) {
  const printQuotes = await prisma.printQuote.findMany({
    where: { pdfPath: { not: null } },
    select: {
      id: true,
      quoteNumber: true,
      pdfPath: true,
    },
  });

  let migrated = 0;
  const warnings: string[] = [];

  for (const printQuote of printQuotes) {
    if (!isLegacyInvoicePdfPath(printQuote.pdfPath)) {
      continue;
    }

    try {
      const localPath = resolveLegacyPath(printQuote.pdfPath);
      const objectKey = printQuotePdfObjectKey(
        printQuote.id,
        printQuote.quoteNumber ?? printQuote.id,
      );

      if (!dryRun) {
        await uploadLegacyFile(localPath, objectKey);
        await prisma.printQuote.update({
          where: { id: printQuote.id },
          data: { pdfPath: objectKey },
        });
      }

      migrated += 1;
    } catch (error) {
      warnings.push(
        `print quote ${printQuote.id}: failed to migrate pdfPath ${printQuote.pdfPath} (${error instanceof Error ? error.message : "unknown error"})`,
      );
    }
  }

  return { migrated, warnings };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const [invoiceResult, printQuoteResult] = await Promise.all([
    migrateInvoices(dryRun),
    migratePrintQuotes(dryRun),
  ]);

  const warningCount = invoiceResult.warnings.length + printQuoteResult.warnings.length;

  console.log(JSON.stringify({
    dryRun,
    invoicesMigrated: invoiceResult.migrated,
    printQuotesMigrated: printQuoteResult.migrated,
    warnings: [...invoiceResult.warnings, ...printQuoteResult.warnings],
  }, null, 2));

  if (warningCount > 0) {
    process.exitCode = 1;
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
