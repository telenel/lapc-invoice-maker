import { ApiError } from "@/domains/shared/types";
import type {
  CopyTechImportCommitResult,
  CopyTechImportCsvFormat,
  CopyTechImportPreview,
} from "./types";

const BASE = "/api/copytech/import";

async function parseJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

function buildUploadForm(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export const copyTechImportApi = {
  async getFormat(): Promise<CopyTechImportCsvFormat> {
    return parseJsonResponse<CopyTechImportCsvFormat>(
      await fetch(BASE, { cache: "no-store" }),
    );
  },

  async preview(file: File): Promise<CopyTechImportPreview> {
    return parseJsonResponse<CopyTechImportPreview>(
      await fetch(`${BASE}?mode=preview`, {
        method: "POST",
        body: buildUploadForm(file),
      }),
    );
  },

  async commit(file: File): Promise<CopyTechImportCommitResult> {
    return parseJsonResponse<CopyTechImportCommitResult>(
      await fetch(`${BASE}?mode=commit`, {
        method: "POST",
        body: buildUploadForm(file),
      }),
    );
  },
};

