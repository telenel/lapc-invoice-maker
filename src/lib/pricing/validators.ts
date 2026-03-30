import { z } from "zod";

const positiveCentsSchema = z.number().int().positive("Amount must be greater than zero");
const quantitySchema = z.number().int().positive("Quantity must be greater than zero");
const optionalMaxSchema = z.number().int().positive().nullable();

export const copyModeSchema = z.enum(["BW", "COLOR"]);
export const copySidesSchema = z.enum(["SINGLE", "DOUBLE"]);
export const posterSaturationSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const bindingTypeSchema = z.enum(["COMB", "GLUE"]);

export const copyEstimateSchema = z.object({
  kind: z.literal("copies"),
  mode: copyModeSchema,
  sides: copySidesSchema,
  totalPages: quantitySchema,
  quantitySets: quantitySchema.default(1),
  paper: z.literal("24LB").default("24LB"),
});

export const posterEstimateSchema = z.object({
  kind: z.literal("poster"),
  quantity: quantitySchema,
  saturation: posterSaturationSchema,
  notes: z.string().trim().max(500).optional(),
});

export const bindingEstimateSchema = z.object({
  kind: z.literal("binding"),
  bindingType: bindingTypeSchema,
  quantity: quantitySchema,
});

export const scanningEstimateSchema = z.object({
  kind: z.literal("scanning"),
  totalPages: quantitySchema,
});

export const printEstimateItemSchema = z.discriminatedUnion("kind", [
  copyEstimateSchema,
  posterEstimateSchema,
  bindingEstimateSchema,
  scanningEstimateSchema,
]);

export const printEstimateRequestSchema = z.object({
  items: z.array(printEstimateItemSchema).min(1, "Add at least one service to the estimate"),
  requesterName: z.string().trim().max(120).optional().default(""),
  requesterEmail: z.string().trim().email("Requester email must be valid").or(z.literal("")).optional().default(""),
  requesterOrganization: z.string().trim().max(160).optional().default(""),
});

export const quantityTierInputSchema = z.object({
  variant: z.string().trim().min(1, "Variant is required"),
  label: z.string().trim().min(1, "Label is required"),
  description: z.string().trim().max(200).optional().default(""),
  minQuantity: quantitySchema,
  maxQuantity: optionalMaxSchema,
  unitPriceCents: positiveCentsSchema,
  sortOrder: z.number().int().min(0).default(0),
});

export const fixedTierInputSchema = z.object({
  variant: z.string().trim().min(1, "Variant is required"),
  label: z.string().trim().min(1, "Label is required"),
  description: z.string().trim().max(200).optional().default(""),
  unitPriceCents: positiveCentsSchema,
  sortOrder: z.number().int().min(0).default(0),
});

export const pricingConfigUpdateSchema = z.object({
  shopTitle: z.string().trim().min(1, "Shop title is required").max(160),
  quotePrefix: z.string().trim().min(1, "Quote prefix is required").max(16),
  quoteDisclaimer: z.string().trim().min(1, "Disclaimer is required").max(500),
  taxEnabled: z.boolean(),
  taxRateBasisPoints: z.number().int().min(0, "Tax rate must be at least 0%").max(10000, "Tax rate must be 100% or less"),
  bwDuplexMultiplierBasisPoints: z.number().int().min(10000, "B&W duplex multiplier must be at least 1.00").max(100000, "B&W duplex multiplier is too large"),
  colorDuplexMultiplierBasisPoints: z.number().int().min(10000, "Color duplex multiplier must be at least 1.00").max(100000, "Color duplex multiplier is too large"),
  minimumScanChargeCents: positiveCentsSchema,
  copyTiers: z.object({
    BW: z.array(quantityTierInputSchema).min(1, "At least one B&W tier is required"),
    COLOR: z.array(quantityTierInputSchema).min(1, "At least one color tier is required"),
  }),
  scanTiers: z.array(quantityTierInputSchema).min(1, "At least one scanning tier is required"),
  posterTiers: z.object({
    LOW: fixedTierInputSchema,
    MEDIUM: fixedTierInputSchema,
    HIGH: fixedTierInputSchema,
  }),
  bindingTiers: z.object({
    COMB: fixedTierInputSchema,
    GLUE: fixedTierInputSchema,
  }),
}).superRefine((value, ctx) => {
  validateTierRanges(value.copyTiers.BW, ["copyTiers", "BW"], ctx);
  validateTierRanges(value.copyTiers.COLOR, ["copyTiers", "COLOR"], ctx);
  validateTierRanges(value.scanTiers, ["scanTiers"], ctx);
});

function validateTierRanges(
  tiers: Array<z.infer<typeof quantityTierInputSchema>>,
  pathPrefix: (string | number)[],
  ctx: z.RefinementCtx
) {
  const sorted = tiers
    .map((tier, index) => ({ ...tier, index }))
    .sort((a, b) => a.minQuantity - b.minQuantity);

  for (const tier of sorted) {
    if (tier.maxQuantity !== null && tier.maxQuantity < tier.minQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum quantity must be greater than or equal to minimum quantity",
        path: [...pathPrefix, tier.index, "maxQuantity"],
      });
    }
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];

    if (!next) {
      if (current.maxQuantity !== null && current.maxQuantity < current.minQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid tier range",
          path: [...pathPrefix, current.index, "maxQuantity"],
        });
      }
      continue;
    }

    if (current.maxQuantity === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only the last tier can be open-ended",
        path: [...pathPrefix, current.index, "maxQuantity"],
      });
      continue;
    }

    if (current.maxQuantity >= next.minQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tier ranges cannot overlap",
        path: [...pathPrefix, next.index, "minQuantity"],
      });
    }
  }
}

export type PrintEstimateRequest = z.infer<typeof printEstimateRequestSchema>;
export type PricingConfigUpdateInput = z.infer<typeof pricingConfigUpdateSchema>;
