#!/usr/bin/env tsx
import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { getLegacyStorageAudit } from "../../src/lib/storage-audit";

async function main() {
  const audit = await getLegacyStorageAudit();

  const [invoiceSamples, printQuoteSamples] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        OR: [
          { pdfPath: { startsWith: "/pdfs/" } },
          { pdfPath: { startsWith: "pdfs/" } },
          { pdfPath: { startsWith: "data/pdfs/" } },
          { prismcorePath: { startsWith: "/uploads/" } },
          { prismcorePath: { startsWith: "uploads/" } },
          { prismcorePath: { startsWith: "public/uploads/" } },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        quoteNumber: true,
        pdfPath: true,
        prismcorePath: true,
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.printQuote.findMany({
      where: {
        OR: [
          { pdfPath: { startsWith: "/pdfs/" } },
          { pdfPath: { startsWith: "pdfs/" } },
          { pdfPath: { startsWith: "data/pdfs/" } },
        ],
      },
      select: {
        id: true,
        quoteNumber: true,
        pdfPath: true,
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  console.log(JSON.stringify({
    audit,
    samples: {
      invoices: invoiceSamples,
      printQuotes: printQuoteSamples,
    },
  }, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
