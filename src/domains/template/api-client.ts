import { ApiError } from "@/domains/shared/types";
import type { TemplateResponse, CreateTemplateInput } from "./types";

const BASE = "/api/templates";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const templateApi = {
  async list(type?: "INVOICE" | "QUOTE"): Promise<TemplateResponse[]> {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    const query = params.toString();
    return request<TemplateResponse[]>(query ? `${BASE}?${query}` : BASE);
  },

  async create(input: CreateTemplateInput): Promise<TemplateResponse> {
    return request<TemplateResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },
};
