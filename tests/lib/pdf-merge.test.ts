// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PDFDocument } from "pdf-lib";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { mergePrismCorePDF } from "@/lib/pdf/merge";

// ---------------------------------------------------------------------------
// Helpers — build minimal in-memory PDFs and write them to tmp files
// ---------------------------------------------------------------------------

async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  return doc.save();
}

// Paths used across tests
const TMP_DIR = path.join(process.cwd(), "tmp-test-pdfs");
const INVOICE_PATH = path.join(TMP_DIR, "invoice.pdf");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const PRISMCORE_RELATIVE = "prismcore-test.pdf"; // relative to public/
const PRISMCORE_ABS = path.join(PUBLIC_DIR, PRISMCORE_RELATIVE);

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(PUBLIC_DIR, { recursive: true });
});

afterAll(async () => {
  // Clean up tmp test artifacts
  for (const p of [INVOICE_PATH, PRISMCORE_ABS]) {
    await unlink(p).catch(() => undefined);
  }
  await unlink(TMP_DIR).catch(() => undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mergePrismCorePDF", () => {
  it("merging a 1-page PrismCore into a 2-page invoice produces a 3-page PDF", async () => {
    // Write fresh 2-page invoice and 1-page PrismCore PDFs
    await writeFile(INVOICE_PATH, await makePdf(2));
    await writeFile(PRISMCORE_ABS, await makePdf(1));

    await mergePrismCorePDF(INVOICE_PATH, PRISMCORE_RELATIVE);

    // Re-read the written file to count pages
    const { readFile } = await import("fs/promises");
    const mergedBytes = await readFile(INVOICE_PATH);
    const mergedDoc = await PDFDocument.load(mergedBytes);
    expect(mergedDoc.getPageCount()).toBe(3);
  });

  it("PrismCore pages are inserted after page 1 (cover sheet), not at the end", async () => {
    // Build a 2-page invoice where each page has a distinguishable size:
    //   page 0 (cover) = 600×800, page 1 (IDP) = 700×900
    const invoiceDoc = await PDFDocument.create();
    invoiceDoc.addPage([600, 800]); // cover sheet
    invoiceDoc.addPage([700, 900]); // IDP
    await writeFile(INVOICE_PATH, await invoiceDoc.save());

    // 1-page PrismCore = 300×400
    const pcDoc = await PDFDocument.create();
    pcDoc.addPage([300, 400]);
    await writeFile(PRISMCORE_ABS, await pcDoc.save());

    await mergePrismCorePDF(INVOICE_PATH, PRISMCORE_RELATIVE);

    const { readFile } = await import("fs/promises");
    const mergedBytes = await readFile(INVOICE_PATH);
    const mergedDoc = await PDFDocument.load(mergedBytes);

    expect(mergedDoc.getPageCount()).toBe(3);

    const pages = mergedDoc.getPages();
    // Cover sheet stays at index 0
    expect(pages[0].getSize()).toMatchObject({ width: 600, height: 800 });
    // PrismCore page inserted at index 1
    expect(pages[1].getSize()).toMatchObject({ width: 300, height: 400 });
    // IDP pushed to index 2
    expect(pages[2].getSize()).toMatchObject({ width: 700, height: 900 });
  });

  it("throws / rejects if the invoice PDF path does not exist", async () => {
    // Write a valid PrismCore so the failure is definitely the invoice path
    await writeFile(PRISMCORE_ABS, await makePdf(1));

    await expect(
      mergePrismCorePDF(
        path.join(TMP_DIR, "nonexistent-invoice.pdf"),
        PRISMCORE_RELATIVE
      )
    ).rejects.toThrow();
  });

  it("throws / rejects if the PrismCore PDF does not exist", async () => {
    // Write a valid invoice so the failure is definitely the PrismCore path
    await writeFile(INVOICE_PATH, await makePdf(2));

    await expect(
      mergePrismCorePDF(INVOICE_PATH, "does-not-exist.pdf")
    ).rejects.toThrow();
  });
});
