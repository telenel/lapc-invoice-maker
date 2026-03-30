export type CopyMode = "BW" | "COLOR";
export type CopySides = "SINGLE" | "DOUBLE";
export type PosterSaturation = "LOW" | "MEDIUM" | "HIGH";
export type BindingType = "COMB" | "GLUE";
export type PrintServiceKind = "copies" | "poster" | "binding" | "scanning";

export interface QuantityTier {
  variant: string;
  label: string;
  description: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPriceCents: number;
  sortOrder: number;
}

export interface FixedTier {
  variant: string;
  label: string;
  description: string;
  unitPriceCents: number;
  sortOrder: number;
}

export interface PrintPricingSnapshot {
  configId: string;
  shopTitle: string;
  quotePrefix: string;
  quoteDisclaimer: string;
  taxEnabled: boolean;
  taxRateBasisPoints: number;
  bwDuplexMultiplierBasisPoints: number;
  colorDuplexMultiplierBasisPoints: number;
  copyTiers: Record<CopyMode, QuantityTier[]>;
  scanTiers: QuantityTier[];
  posterTiers: Record<PosterSaturation, FixedTier>;
  bindingTiers: Record<BindingType, FixedTier>;
  minimumScanChargeCents: number;
}

export interface CopyEstimateInput {
  kind: "copies";
  mode: CopyMode;
  sides: CopySides;
  totalPages: number;
  quantitySets: number;
  paper: "24LB";
}

export interface PosterEstimateInput {
  kind: "poster";
  quantity: number;
  saturation: PosterSaturation;
  notes?: string;
}

export interface BindingEstimateInput {
  kind: "binding";
  bindingType: BindingType;
  quantity: number;
}

export interface ScanningEstimateInput {
  kind: "scanning";
  totalPages: number;
}

export type PrintEstimateInput =
  | CopyEstimateInput
  | PosterEstimateInput
  | BindingEstimateInput
  | ScanningEstimateInput;

export interface CalculatedQuoteLineItem {
  service: "COPY" | "POSTER" | "BINDING" | "SCANNING";
  variant: string;
  description: string;
  details: string;
  quantity: number;
  unitPriceCents: number;
  effectiveUnitPriceCents: number;
  lineTotalCents: number;
  selectedTierLabel: string;
  selectedTierDescription?: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface CalculatedQuote {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxEnabled: boolean;
  taxRateBasisPoints: number;
  lineItems: CalculatedQuoteLineItem[];
}

const BASIS_POINTS_SCALE = 10_000;
const CENTS_PER_DOLLAR = 100;

export function multiplyCentsByBasisPoints(cents: number, basisPoints: number): number {
  return Math.round((cents * basisPoints) / BASIS_POINTS_SCALE);
}

export function centsToCurrency(cents: number): string {
  return `$${(cents / CENTS_PER_DOLLAR).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function centsToNumber(cents: number): number {
  return Number((cents / CENTS_PER_DOLLAR).toFixed(2));
}

export function percentBasisPointsToLabel(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function selectQuantityTier(tiers: QuantityTier[], quantity: number): QuantityTier {
  const selected = tiers.find(
    (tier) => quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity)
  );

  if (!selected) {
    throw new Error(`No pricing tier found for quantity ${quantity}`);
  }

  return selected;
}

function calculateCopyLineItem(
  input: CopyEstimateInput,
  pricing: PrintPricingSnapshot
): CalculatedQuoteLineItem {
  const totalBillablePages = input.totalPages * input.quantitySets;
  const tier = selectQuantityTier(pricing.copyTiers[input.mode], totalBillablePages);
  const duplexMultiplier =
    input.mode === "BW"
      ? pricing.bwDuplexMultiplierBasisPoints
      : pricing.colorDuplexMultiplierBasisPoints;
  const effectiveUnitPriceCents =
    input.sides === "DOUBLE"
      ? multiplyCentsByBasisPoints(tier.unitPriceCents, duplexMultiplier)
      : tier.unitPriceCents;
  const lineTotalCents = effectiveUnitPriceCents * totalBillablePages;
  const printModeLabel = input.mode === "BW" ? "B&W" : "Color";
  const sidesLabel = input.sides === "DOUBLE" ? "Double-sided" : "Single-sided";

  return {
    service: "COPY",
    variant: input.mode,
    description: `${printModeLabel} copies`,
    details: `${sidesLabel}, ${input.totalPages} ${pluralize(input.totalPages, "page")}, ${input.quantitySets} ${pluralize(input.quantitySets, "set")}, 24 lb copy paper`,
    quantity: totalBillablePages,
    unitPriceCents: tier.unitPriceCents,
    effectiveUnitPriceCents,
    lineTotalCents,
    selectedTierLabel: tier.label,
    selectedTierDescription: tier.description,
    metadata: {
      totalPages: input.totalPages,
      quantitySets: input.quantitySets,
      sides: input.sides,
      printMode: input.mode,
      paper: input.paper,
      totalBillablePages,
      duplexApplied: input.sides === "DOUBLE",
      duplexMultiplierBasisPoints: input.sides === "DOUBLE" ? duplexMultiplier : null,
    },
  };
}

function calculatePosterLineItem(
  input: PosterEstimateInput,
  pricing: PrintPricingSnapshot
): CalculatedQuoteLineItem {
  const tier = pricing.posterTiers[input.saturation];
  const lineTotalCents = tier.unitPriceCents * input.quantity;

  return {
    service: "POSTER",
    variant: input.saturation,
    description: '24" x 36" poster',
    details: `${tier.label} saturation${input.notes ? `, ${input.notes}` : ""}`,
    quantity: input.quantity,
    unitPriceCents: tier.unitPriceCents,
    effectiveUnitPriceCents: tier.unitPriceCents,
    lineTotalCents,
    selectedTierLabel: tier.label,
    selectedTierDescription: tier.description,
    metadata: {
      saturation: input.saturation,
      notes: input.notes ?? "",
    },
  };
}

function calculateBindingLineItem(
  input: BindingEstimateInput,
  pricing: PrintPricingSnapshot
): CalculatedQuoteLineItem {
  const tier = pricing.bindingTiers[input.bindingType];
  const lineTotalCents = tier.unitPriceCents * input.quantity;

  return {
    service: "BINDING",
    variant: input.bindingType,
    description: `${tier.label} binding`,
    details: `${input.quantity} ${pluralize(input.quantity, "bound item")}`,
    quantity: input.quantity,
    unitPriceCents: tier.unitPriceCents,
    effectiveUnitPriceCents: tier.unitPriceCents,
    lineTotalCents,
    selectedTierLabel: tier.label,
    selectedTierDescription: tier.description,
    metadata: {
      bindingType: input.bindingType,
    },
  };
}

function calculateScanningLineItem(
  input: ScanningEstimateInput,
  pricing: PrintPricingSnapshot
): CalculatedQuoteLineItem {
  const tier = selectQuantityTier(pricing.scanTiers, input.totalPages);
  const rawLineTotalCents = tier.unitPriceCents * input.totalPages;
  const lineTotalCents = Math.max(rawLineTotalCents, pricing.minimumScanChargeCents);
  const effectiveUnitPriceCents = Math.round(lineTotalCents / input.totalPages);

  return {
    service: "SCANNING",
    variant: "SCAN",
    description: "Scanning",
    details:
      lineTotalCents === pricing.minimumScanChargeCents && rawLineTotalCents < pricing.minimumScanChargeCents
        ? `Minimum charge applied for ${input.totalPages} ${pluralize(input.totalPages, "page")}`
        : `${input.totalPages} ${pluralize(input.totalPages, "page")} scanned`,
    quantity: input.totalPages,
    unitPriceCents: tier.unitPriceCents,
    effectiveUnitPriceCents,
    lineTotalCents,
    selectedTierLabel: tier.label,
    selectedTierDescription: tier.description,
    metadata: {
      totalPages: input.totalPages,
      minimumChargeApplied: lineTotalCents !== rawLineTotalCents,
      minimumChargeCents: pricing.minimumScanChargeCents,
      rawLineTotalCents,
    },
  };
}

export function calculatePrintShopQuote(
  inputs: PrintEstimateInput[],
  pricing: PrintPricingSnapshot
): CalculatedQuote {
  const lineItems = inputs.map((input) => {
    switch (input.kind) {
      case "copies":
        return calculateCopyLineItem(input, pricing);
      case "poster":
        return calculatePosterLineItem(input, pricing);
      case "binding":
        return calculateBindingLineItem(input, pricing);
      case "scanning":
        return calculateScanningLineItem(input, pricing);
      default:
        throw new Error("Unsupported print estimate item");
    }
  });

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const taxCents = pricing.taxEnabled
    ? multiplyCentsByBasisPoints(subtotalCents, pricing.taxRateBasisPoints)
    : 0;

  return {
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    taxEnabled: pricing.taxEnabled,
    taxRateBasisPoints: pricing.taxRateBasisPoints,
    lineItems,
  };
}
