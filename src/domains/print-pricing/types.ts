import type {
  BindingType,
  CalculatedQuote,
  CopyMode,
  FixedTier,
  PosterSaturation,
  PrintEstimateInput,
  PrintPricingSnapshot,
  QuantityTier,
} from "@/lib/pricing/print-shop-pricing";

export type {
  BindingType,
  CalculatedQuote,
  CopyMode,
  FixedTier,
  PosterSaturation,
  PrintEstimateInput,
  PrintPricingSnapshot,
  QuantityTier,
};

export interface PrintQuoteRecordResponse extends CalculatedQuote {
  id: string;
  quoteNumber: string;
  pdfPath: string | null;
  createdAt: string;
  requesterName: string;
  requesterEmail: string;
  requesterOrganization: string;
  shopTitle: string;
  disclaimer: string;
}

export interface GeneratePrintQuoteResponse {
  quoteId: string;
  quoteNumber: string;
  downloadUrl: string;
}

export interface TierSeedInput {
  service: "COPY" | "POSTER" | "BINDING" | "SCANNING";
  variant: string;
  label: string;
  description: string;
  minQuantity: number | null;
  maxQuantity: number | null;
  unitPriceCents: number;
  sortOrder: number;
}
