import { ApiError } from "@/domains/shared/types";

const BASE = "/api/upload";

export interface UploadResponse {
  path: string;
  filename: string;
}

export const uploadApi = {
  async uploadPdf(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(BASE, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.json();
  },
};
