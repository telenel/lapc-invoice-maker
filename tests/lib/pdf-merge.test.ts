// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePrismCorePDF } from "@/lib/pdf/merge";

async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  return Buffer.from(await doc.save());
}

describe("mergePrismCorePDF", () => {
  it("merging a 1-page PrismCore into a 2-page invoice produces a 3-page PDF", async () => {
    const mergedBytes = await mergePrismCorePDF(
      await makePdf(2),
      await makePdf(1)
    );

    const mergedDoc = await PDFDocument.load(mergedBytes);
    expect(mergedDoc.getPageCount()).toBe(3);
  });

  it("PrismCore pages are inserted after page 1 (cover sheet), not at the end", async () => {
    const invoiceDoc = await PDFDocument.create();
    invoiceDoc.addPage([600, 800]);
    invoiceDoc.addPage([700, 900]);

    const pcDoc = await PDFDocument.create();
    pcDoc.addPage([300, 400]);

    const mergedBytes = await mergePrismCorePDF(
      Buffer.from(await invoiceDoc.save()),
      Buffer.from(await pcDoc.save())
    );

    const mergedDoc = await PDFDocument.load(mergedBytes);
    expect(mergedDoc.getPageCount()).toBe(3);

    const pages = mergedDoc.getPages();
    expect(pages[0].getSize()).toMatchObject({ width: 600, height: 800 });
    expect(pages[1].getSize()).toMatchObject({ width: 300, height: 400 });
    expect(pages[2].getSize()).toMatchObject({ width: 700, height: 900 });
  });

  it("throws / rejects if the invoice PDF buffer is invalid", async () => {
    await expect(
      mergePrismCorePDF(Buffer.from("not-a-pdf"), await makePdf(1))
    ).rejects.toThrow();
  });

  it("throws / rejects if the PrismCore PDF buffer is invalid", async () => {
    await expect(
      mergePrismCorePDF(await makePdf(2), Buffer.from("not-a-pdf"))
    ).rejects.toThrow();
  });
});
