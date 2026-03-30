import { prisma } from "@/lib/prisma";
import type { PricingConfigUpdateInput } from "@/lib/pricing/validators";

export const printPricingRepository = {
  async findConfig() {
    return prisma.printPricingConfig.findUnique({
      where: { id: "default" },
      include: {
        tiers: {
          orderBy: [{ service: "asc" }, { sortOrder: "asc" }, { minQuantity: "asc" }],
        },
      },
    });
  },

  async upsertConfig(input: PricingConfigUpdateInput) {
    return prisma.$transaction(async (tx) => {
      const config = await tx.printPricingConfig.upsert({
        where: { id: "default" },
        update: {
          shopTitle: input.shopTitle,
          quotePrefix: input.quotePrefix,
          quoteDisclaimer: input.quoteDisclaimer,
          taxEnabled: input.taxEnabled,
          taxRateBasisPoints: input.taxRateBasisPoints,
          bwDuplexMultiplierBasisPoints: input.bwDuplexMultiplierBasisPoints,
          colorDuplexMultiplierBasisPoints: input.colorDuplexMultiplierBasisPoints,
        },
        create: {
          id: "default",
          shopTitle: input.shopTitle,
          quotePrefix: input.quotePrefix,
          quoteDisclaimer: input.quoteDisclaimer,
          taxEnabled: input.taxEnabled,
          taxRateBasisPoints: input.taxRateBasisPoints,
          bwDuplexMultiplierBasisPoints: input.bwDuplexMultiplierBasisPoints,
          colorDuplexMultiplierBasisPoints: input.colorDuplexMultiplierBasisPoints,
        },
      });

      await tx.printPricingTier.deleteMany({
        where: { configId: config.id },
      });

      await tx.printPricingTier.createMany({
        data: [
          ...input.copyTiers.BW.map((tier) => ({
            configId: config.id,
            service: "COPY" as const,
            variant: tier.variant,
            label: tier.label,
            description: tier.description || null,
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity,
            unitPriceCents: tier.unitPriceCents,
            sortOrder: tier.sortOrder,
          })),
          ...input.copyTiers.COLOR.map((tier) => ({
            configId: config.id,
            service: "COPY" as const,
            variant: tier.variant,
            label: tier.label,
            description: tier.description || null,
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity,
            unitPriceCents: tier.unitPriceCents,
            sortOrder: tier.sortOrder,
          })),
          ...input.scanTiers.map((tier) => ({
            configId: config.id,
            service: "SCANNING" as const,
            variant: tier.variant,
            label: tier.label,
            description: tier.description || null,
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity,
            unitPriceCents: tier.unitPriceCents,
            sortOrder: tier.sortOrder,
          })),
          ...Object.values(input.posterTiers).map((tier) => ({
            configId: config.id,
            service: "POSTER" as const,
            variant: tier.variant,
            label: tier.label,
            description: tier.description || null,
            minQuantity: null,
            maxQuantity: null,
            unitPriceCents: tier.unitPriceCents,
            sortOrder: tier.sortOrder,
          })),
          ...Object.values(input.bindingTiers).map((tier) => ({
            configId: config.id,
            service: "BINDING" as const,
            variant: tier.variant,
            label: tier.label,
            description: tier.description || null,
            minQuantity: null,
            maxQuantity: null,
            unitPriceCents: tier.unitPriceCents,
            sortOrder: tier.sortOrder,
          })),
          {
            configId: config.id,
            service: "SCANNING" as const,
            variant: "MINIMUM_CHARGE",
            label: "Minimum Scan Charge",
            description: "Minimum charge applied to low-volume scanning jobs.",
            minQuantity: null,
            maxQuantity: null,
            unitPriceCents: input.minimumScanChargeCents,
            sortOrder: 999,
          },
        ],
      });

      return tx.printPricingConfig.findUniqueOrThrow({
        where: { id: config.id },
        include: {
          tiers: {
            orderBy: [{ service: "asc" }, { sortOrder: "asc" }, { minQuantity: "asc" }],
          },
        },
      });
    });
  },

  async findLatestQuoteNumber(prefix: string, year: number) {
    return prisma.printQuote.findFirst({
      where: {
        quoteNumber: {
          startsWith: `${prefix}-${year}-`,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        quoteNumber: true,
      },
    });
  },

  async createQuote(input: {
    quoteNumber: string;
    createdBy: string | null;
    requesterName: string;
    requesterEmail: string;
    requesterOrganization: string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    taxEnabled: boolean;
    taxRateBasisPoints: number;
    disclaimer: string;
    shopTitle: string;
    pdfPath: string | null;
    lineItems: Array<{
      service: "COPY" | "POSTER" | "BINDING" | "SCANNING";
      variant: string;
      description: string;
      details: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
      metadata: Record<string, string | number | boolean | null>;
      sortOrder: number;
    }>;
  }) {
    return prisma.printQuote.create({
      data: {
        pricingConfigId: "default",
        quoteNumber: input.quoteNumber,
        createdBy: input.createdBy,
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        requesterOrganization: input.requesterOrganization,
        subtotalCents: input.subtotalCents,
        taxCents: input.taxCents,
        totalCents: input.totalCents,
        taxEnabled: input.taxEnabled,
        taxRateBasisPoints: input.taxRateBasisPoints,
        disclaimer: input.disclaimer,
        shopTitle: input.shopTitle,
        pdfPath: input.pdfPath,
        lineItems: {
          create: input.lineItems.map((item) => ({
            service: item.service,
            variant: item.variant,
            description: item.description,
            details: item.details,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
            metadata: item.metadata,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        lineItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  },

  async updateQuotePdfPath(id: string, pdfPath: string) {
    return prisma.printQuote.update({
      where: { id },
      data: { pdfPath },
    });
  },

  async findQuoteById(id: string) {
    return prisma.printQuote.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  },
};
