import { ApiError } from "@/domains/shared/types";
import type {
  GeneratePrintQuoteResponse,
  PrintEstimateInput,
  PrintPricingSnapshot,
} from "@/domains/print-pricing/types";
import type { PricingConfigUpdateInput } from "@/lib/pricing/validators";

const PUBLIC_PRICING_BASE = "/api/print-pricing";
const ADMIN_PRICING_BASE = "/api/admin/pricing";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  return response.json();
}

export const printPricingApi = {
  async getPricingConfig(): Promise<PrintPricingSnapshot> {
    return request<PrintPricingSnapshot>(PUBLIC_PRICING_BASE);
  },

  async updatePricingConfig(input: PricingConfigUpdateInput): Promise<PrintPricingSnapshot> {
    return request<PrintPricingSnapshot>(ADMIN_PRICING_BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async generateQuote(input: {
    items: PrintEstimateInput[];
    requesterName?: string;
    requesterEmail?: string;
    requesterOrganization?: string;
  }): Promise<GeneratePrintQuoteResponse> {
    return request<GeneratePrintQuoteResponse>(`${PUBLIC_PRICING_BASE}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
