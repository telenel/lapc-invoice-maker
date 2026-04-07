import { pdfStorage } from "@/domains/pdf/storage";
import { defaultPrintPricingConfig } from "@/domains/print-pricing/defaults";
import { printPricingRepository } from "@/domains/print-pricing/repository";
import { Prisma } from "@/generated/prisma/client";
import type {
  GeneratePrintQuoteResponse,
  PrintPricingSnapshot,
  PrintQuoteRecordResponse,
} from "@/domains/print-pricing/types";
import { generatePrintQuotePdf } from "@/lib/pdf/generate-print-quote";
import {
  calculatePrintShopQuote,
  centsToNumber,
  percentBasisPointsToLabel,
  type BindingType,
  type FixedTier,
  type PosterSaturation,
  type QuantityTier,
} from "@/lib/pricing/print-shop-pricing";
import {
  pricingConfigUpdateSchema,
  printEstimateRequestSchema,
  type PricingConfigUpdateInput,
} from "@/lib/pricing/validators";

type ConfigRecord = NonNullable<Awaited<ReturnType<typeof printPricingRepository.findConfig>>>;
type QuoteRecord = NonNullable<Awaited<ReturnType<typeof printPricingRepository.findQuoteById>>>;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function toQuantityTier(record: {
  variant: string;
  label: string;
  description: string | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  unitPriceCents: number;
  sortOrder: number;
}): QuantityTier {
  invariant(record.minQuantity !== null, `Missing minimum quantity for tier ${record.label}`);

  return {
    variant: record.variant,
    label: record.label,
    description: record.description ?? "",
    minQuantity: record.minQuantity,
    maxQuantity: record.maxQuantity,
    unitPriceCents: record.unitPriceCents,
    sortOrder: record.sortOrder,
  };
}

function toFixedTier(record: {
  variant: string;
  label: string;
  description: string | null;
  unitPriceCents: number;
  sortOrder: number;
}): FixedTier {
  return {
    variant: record.variant,
    label: record.label,
    description: record.description ?? "",
    unitPriceCents: record.unitPriceCents,
    sortOrder: record.sortOrder,
  };
}

function requireVariantTier<T extends string>(
  tiers: Array<{
    variant: string;
    label: string;
    description: string | null;
    unitPriceCents: number;
    sortOrder: number;
  }>,
  variant: T
): FixedTier {
  const tier = tiers.find((entry) => entry.variant === variant);
  invariant(tier, `Missing pricing tier for ${variant}`);
  return toFixedTier(tier);
}

function toPricingSnapshot(record: ConfigRecord): PrintPricingSnapshot {
  const minimumScanChargeTier = record.tiers.find(
    (tier) => tier.service === "SCANNING" && tier.variant === "MINIMUM_CHARGE"
  );

  invariant(minimumScanChargeTier, "Missing minimum scan charge configuration");

  const copyTiers = record.tiers.filter((tier) => tier.service === "COPY");
  const scanTiers = record.tiers.filter(
    (tier) => tier.service === "SCANNING" && tier.variant !== "MINIMUM_CHARGE"
  );
  const posterTiers = record.tiers.filter((tier) => tier.service === "POSTER");
  const bindingTiers = record.tiers.filter((tier) => tier.service === "BINDING");

  return {
    configId: record.id,
    shopTitle: record.shopTitle,
    quotePrefix: record.quotePrefix,
    quoteDisclaimer: record.quoteDisclaimer,
    taxEnabled: record.taxEnabled,
    taxRateBasisPoints: record.taxRateBasisPoints,
    bwDuplexMultiplierBasisPoints: record.bwDuplexMultiplierBasisPoints,
    colorDuplexMultiplierBasisPoints: record.colorDuplexMultiplierBasisPoints,
    copyTiers: {
      BW: copyTiers.filter((tier) => tier.variant === "BW").map(toQuantityTier),
      COLOR: copyTiers.filter((tier) => tier.variant === "COLOR").map(toQuantityTier),
    },
    scanTiers: scanTiers.map(toQuantityTier),
    posterTiers: {
      LOW: requireVariantTier<PosterSaturation>(posterTiers, "LOW"),
      MEDIUM: requireVariantTier<PosterSaturation>(posterTiers, "MEDIUM"),
      HIGH: requireVariantTier<PosterSaturation>(posterTiers, "HIGH"),
    },
    bindingTiers: {
      COMB: requireVariantTier<BindingType>(bindingTiers, "COMB"),
      GLUE: requireVariantTier<BindingType>(bindingTiers, "GLUE"),
    },
    minimumScanChargeCents: minimumScanChargeTier.unitPriceCents,
  };
}

async function ensurePricingConfig(): Promise<ConfigRecord> {
  const existing = await printPricingRepository.findConfig();
  if (existing) {
    return existing;
  }

  return printPricingRepository.upsertConfig(defaultPrintPricingConfig);
}

async function generateQuoteNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const latest = await printPricingRepository.findLatestQuoteNumber(prefix, year);
  const nextSequence = latest?.quoteNumber
    ? Number.parseInt(latest.quoteNumber.split("-").pop() ?? "0", 10) + 1
    : 1;

  return `${prefix}-${year}-${String(nextSequence).padStart(4, "0")}`;
}

function toQuoteRecordResponse(record: QuoteRecord): PrintQuoteRecordResponse {
  return {
    id: record.id,
    quoteNumber: record.quoteNumber,
    pdfPath: record.pdfPath,
    createdAt: record.createdAt.toISOString(),
    requesterName: record.requesterName,
    requesterEmail: record.requesterEmail,
    requesterOrganization: record.requesterOrganization,
    shopTitle: record.shopTitle,
    disclaimer: record.disclaimer,
    subtotalCents: record.subtotalCents,
    taxCents: record.taxCents,
    totalCents: record.totalCents,
    taxEnabled: record.taxEnabled,
    taxRateBasisPoints: record.taxRateBasisPoints,
    lineItems: record.lineItems.map((item) => ({
      service: item.service,
      variant: item.variant,
      description: item.description,
      details: item.details ?? "",
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      effectiveUnitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      selectedTierLabel: item.description,
      metadata: (item.metadata as Record<string, string | number | boolean | null>) ?? {},
    })),
  };
}

export const printPricingService = {
  async getPricingSnapshot(): Promise<PrintPricingSnapshot> {
    return toPricingSnapshot(await ensurePricingConfig());
  },

  async updatePricingConfig(input: PricingConfigUpdateInput | unknown): Promise<PrintPricingSnapshot> {
    const parsed = pricingConfigUpdateSchema.parse(input);
    const updated = await printPricingRepository.upsertConfig(parsed);
    return toPricingSnapshot(updated);
  },

  async generateQuote(
    input: unknown,
    createdBy: string | null = null
  ): Promise<GeneratePrintQuoteResponse> {
    const parsed = printEstimateRequestSchema.parse(input);
    const pricing = await this.getPricingSnapshot();
    const calculated = calculatePrintShopQuote(parsed.items, pricing);
    let quote: Awaited<ReturnType<typeof printPricingRepository.createQuote>> | null = null;
    let quoteNumber = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      quoteNumber = await generateQuoteNumber(pricing.quotePrefix);
      try {
        quote = await printPricingRepository.createQuote({
          quoteNumber,
          createdBy,
          requesterName: parsed.requesterName,
          requesterEmail: parsed.requesterEmail,
          requesterOrganization: parsed.requesterOrganization,
          subtotalCents: calculated.subtotalCents,
          taxCents: calculated.taxCents,
          totalCents: calculated.totalCents,
          taxEnabled: calculated.taxEnabled,
          taxRateBasisPoints: calculated.taxRateBasisPoints,
          disclaimer: pricing.quoteDisclaimer,
          shopTitle: pricing.shopTitle,
          pdfPath: null,
          lineItems: calculated.lineItems.map((item, index) => ({
            service: item.service,
            variant: item.variant,
            description: item.description,
            details: item.details,
            quantity: item.quantity,
            unitPriceCents: item.effectiveUnitPriceCents,
            lineTotalCents: item.lineTotalCents,
            metadata: item.metadata,
            sortOrder: index,
          })),
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === "P2002"
          && attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    invariant(quote, "Failed to create print quote");

    const createdAtLabel = new Date(quote.createdAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const pdfBuffer = await generatePrintQuotePdf({
      shopTitle: pricing.shopTitle,
      quoteNumber,
      createdAt: createdAtLabel,
      requesterName: quote.requesterName,
      requesterEmail: quote.requesterEmail,
      requesterOrganization: quote.requesterOrganization,
      subtotal: centsToNumber(calculated.subtotalCents),
      tax: centsToNumber(calculated.taxCents),
      total: centsToNumber(calculated.totalCents),
      taxEnabled: calculated.taxEnabled,
      taxRateLabel: percentBasisPointsToLabel(calculated.taxRateBasisPoints),
      disclaimer: pricing.quoteDisclaimer,
      items: calculated.lineItems.map((item) => ({
        description: item.description,
        details: item.details,
        quantity: item.quantity,
        unitPrice: centsToNumber(item.effectiveUnitPriceCents),
        lineTotal: centsToNumber(item.lineTotalCents),
      })),
    });

    const pdfPath = await pdfStorage.write(
      pdfStorage.printQuoteKey(quote.id, quoteNumber),
      pdfBuffer
    );

    await printPricingRepository.updateQuotePdfPath(quote.id, pdfPath);

    return {
      quoteId: quote.id,
      quoteNumber,
      downloadUrl: `/api/print-pricing/quotes/${quote.id}/pdf`,
    };
  },

  async getQuotePdfBuffer(quoteId: string): Promise<{ buffer: Buffer; quoteNumber: string }> {
    const quote = await printPricingRepository.findQuoteById(quoteId);
    if (!quote || !quote.pdfPath) {
      throw new Error("Quote PDF not found");
    }

    return {
      buffer: await pdfStorage.read(quote.pdfPath),
      quoteNumber: quote.quoteNumber,
    };
  },

  async getQuoteById(quoteId: string): Promise<PrintQuoteRecordResponse | null> {
    const quote = await printPricingRepository.findQuoteById(quoteId);
    if (!quote) {
      return null;
    }
    return toQuoteRecordResponse(quote);
  },
};
