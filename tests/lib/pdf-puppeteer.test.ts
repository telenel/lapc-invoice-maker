// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMock = vi.fn();
const launchMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: (...args: unknown[]) => accessMock(...args),
}));

vi.mock("puppeteer", () => ({
  default: {
    launch: (...args: unknown[]) => launchMock(...args),
  },
}));

import { renderHtmlToPdf } from "@/lib/pdf/puppeteer";

describe("renderHtmlToPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.mockResolvedValue(undefined);
  });

  it("renders PDFs without browser headers and with CSS page sizing", async () => {
    const setContentMock = vi.fn().mockResolvedValue(undefined);
    const pdfMock = vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]));
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const newPageMock = vi.fn().mockResolvedValue({
      setContent: setContentMock,
      pdf: pdfMock,
    });

    launchMock.mockResolvedValue({
      newPage: newPageMock,
      close: closeMock,
    });

    const result = await renderHtmlToPdf("<html><body>Hello</body></html>");

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: expect.arrayContaining([
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ]),
      }),
    );
    expect(setContentMock).toHaveBeenCalledWith(
      "<html><body>Hello</body></html>",
      { waitUntil: "networkidle0" },
    );
    expect(pdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        printBackground: true,
      }),
    );
    expect(result).toEqual(Buffer.from([1, 2, 3]));
    expect(closeMock).toHaveBeenCalled();
  });
});
