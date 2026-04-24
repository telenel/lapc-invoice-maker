import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTechImportApi } from "@/domains/copytech-import/api-client";
import { ApiError } from "@/domains/shared/types";
import type { CopyTechImportPreview } from "@/domains/copytech-import/types";

const previewWithErrors: CopyTechImportPreview = {
  format: { requiredHeaders: [], optionalHeaders: [], exampleCsv: "", notes: [] },
  rowCount: 1,
  skippedRowCount: 0,
  erroredRowCount: 1,
  validRowCount: 0,
  invoiceCount: 0,
  totalAmount: 0,
  errors: [{ rowNumber: 2, field: "sku", message: "sku is required" }],
  warnings: [],
  invoices: [],
};

describe("copyTechImportApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns validation previews from 422 preview responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(previewWithErrors), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(copyTechImportApi.preview(new File(["csv"], "copytech.csv", { type: "text/csv" })))
      .resolves
      .toEqual(previewWithErrors);
  });

  it("still throws ApiError for non-preview error payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Only CSV files are allowed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(copyTechImportApi.preview(new File(["bad"], "copytech.txt", { type: "text/plain" })))
      .rejects
      .toBeInstanceOf(ApiError);
  });
});
