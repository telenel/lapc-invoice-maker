import { describe, expect, it } from "vitest";
import { defaultPrintPricingConfig } from "@/domains/print-pricing/defaults";
import {
  calculatePrintShopQuote,
  multiplyCentsByBasisPoints,
  type BindingType,
  type CopyMode,
  type PosterSaturation,
  type PrintPricingSnapshot,
} from "@/lib/pricing/print-shop-pricing";

function createPricingSnapshot(overrides: Partial<PrintPricingSnapshot> = {}): PrintPricingSnapshot {
  return {
    configId: "default",
    shopTitle: defaultPrintPricingConfig.shopTitle,
    quotePrefix: defaultPrintPricingConfig.quotePrefix,
    quoteDisclaimer: defaultPrintPricingConfig.quoteDisclaimer,
    taxEnabled: defaultPrintPricingConfig.taxEnabled,
    taxRateBasisPoints: defaultPrintPricingConfig.taxRateBasisPoints,
    bwDuplexMultiplierBasisPoints: defaultPrintPricingConfig.bwDuplexMultiplierBasisPoints,
    colorDuplexMultiplierBasisPoints: defaultPrintPricingConfig.colorDuplexMultiplierBasisPoints,
    copyTiers: {
      BW: defaultPrintPricingConfig.copyTiers.BW.map((tier) => ({ ...tier })),
      COLOR: defaultPrintPricingConfig.copyTiers.COLOR.map((tier) => ({ ...tier })),
    },
    scanTiers: defaultPrintPricingConfig.scanTiers.map((tier) => ({ ...tier })),
    posterTiers: {
      LOW: { ...defaultPrintPricingConfig.posterTiers.LOW },
      MEDIUM: { ...defaultPrintPricingConfig.posterTiers.MEDIUM },
      HIGH: { ...defaultPrintPricingConfig.posterTiers.HIGH },
    },
    bindingTiers: {
      COMB: { ...defaultPrintPricingConfig.bindingTiers.COMB },
      GLUE: { ...defaultPrintPricingConfig.bindingTiers.GLUE },
    },
    minimumScanChargeCents: defaultPrintPricingConfig.minimumScanChargeCents,
    ...overrides,
  };
}

function calculateCopy(mode: CopyMode, pages: number, sides: "SINGLE" | "DOUBLE" = "SINGLE") {
  return calculatePrintShopQuote(
    [
      {
        kind: "copies",
        mode,
        sides,
        totalPages: pages,
        quantitySets: 1,
        paper: "24LB",
      },
    ],
    createPricingSnapshot()
  );
}

function calculatePoster(saturation: PosterSaturation, quantity: number) {
  return calculatePrintShopQuote(
    [{ kind: "poster", saturation, quantity }],
    createPricingSnapshot()
  );
}

function calculateBinding(bindingType: BindingType, quantity: number) {
  return calculatePrintShopQuote(
    [{ kind: "binding", bindingType, quantity }],
    createPricingSnapshot()
  );
}

describe("print shop pricing engine", () => {
  it("uses the first B&W tier up to 49 pages", () => {
    const result = calculateCopy("BW", 49);

    expect(result.lineItems[0].effectiveUnitPriceCents).toBe(15);
    expect(result.totalCents).toBe(735);
  });

  it("switches B&W pricing at the 250-page boundary", () => {
    const result = calculateCopy("BW", 250);

    expect(result.lineItems[0].effectiveUnitPriceCents).toBe(11);
    expect(result.totalCents).toBe(2750);
  });

  it("uses the correct color tier boundaries", () => {
    const resultAt80 = calculateCopy("COLOR", 80);
    const resultAt600 = calculateCopy("COLOR", 600);

    expect(resultAt80.lineItems[0].effectiveUnitPriceCents).toBe(47);
    expect(resultAt80.totalCents).toBe(3760);

    expect(resultAt600.lineItems[0].effectiveUnitPriceCents).toBe(39);
    expect(resultAt600.totalCents).toBe(23400);
  });

  it("rounds duplex multipliers to cents before extending the line total", () => {
    const effectiveUnitCents = multiplyCentsByBasisPoints(13, 17000);
    const result = calculateCopy("BW", 100, "DOUBLE");

    expect(effectiveUnitCents).toBe(22);
    expect(result.lineItems[0].effectiveUnitPriceCents).toBe(22);
    expect(result.totalCents).toBe(2200);
  });

  it("prices posters by saturation tier", () => {
    const result = calculatePoster("MEDIUM", 2);

    expect(result.lineItems[0].effectiveUnitPriceCents).toBe(2200);
    expect(result.totalCents).toBe(4400);
  });

  it("prices binding as a flat per-item rate", () => {
    const result = calculateBinding("COMB", 3);

    expect(result.lineItems[0].effectiveUnitPriceCents).toBe(500);
    expect(result.totalCents).toBe(1500);
  });

  it("uses scanning tiers based on page count", () => {
    const fiftyPages = calculatePrintShopQuote(
      [{ kind: "scanning", totalPages: 50 }],
      createPricingSnapshot()
    );

    expect(fiftyPages.lineItems[0].effectiveUnitPriceCents).toBe(18);
    expect(fiftyPages.totalCents).toBe(900);
  });

  it("enforces the minimum scan charge when the per-page total falls below it", () => {
    const result = calculatePrintShopQuote(
      [{ kind: "scanning", totalPages: 5 }],
      createPricingSnapshot()
    );

    expect(result.lineItems[0].lineTotalCents).toBe(200);
    expect(result.lineItems[0].metadata.minimumChargeApplied).toBe(true);
  });

  it("builds totals across multiple services", () => {
    const result = calculatePrintShopQuote(
      [
        { kind: "copies", mode: "BW", sides: "SINGLE", totalPages: 40, quantitySets: 1, paper: "24LB" },
        { kind: "poster", saturation: "MEDIUM", quantity: 2 },
        { kind: "binding", bindingType: "COMB", quantity: 3 },
      ],
      createPricingSnapshot()
    );

    expect(result.subtotalCents).toBe(600 + 4400 + 1500);
    expect(result.totalCents).toBe(6500);
  });

  it("calculates sales tax from subtotal cents when enabled", () => {
    const result = calculatePrintShopQuote(
      [
        { kind: "copies", mode: "BW", sides: "SINGLE", totalPages: 40, quantitySets: 1, paper: "24LB" },
        { kind: "poster", saturation: "LOW", quantity: 1 },
      ],
      createPricingSnapshot({
        taxEnabled: true,
        taxRateBasisPoints: 975,
      })
    );

    expect(result.subtotalCents).toBe(2100);
    expect(result.taxCents).toBe(205);
    expect(result.totalCents).toBe(2305);
  });

  it("keeps representative quotes deterministic in cents", () => {
    const pricing = createPricingSnapshot();

    const copy40 = calculatePrintShopQuote(
      [{ kind: "copies", mode: "BW", sides: "SINGLE", totalPages: 40, quantitySets: 1, paper: "24LB" }],
      pricing
    );
    const copy250 = calculatePrintShopQuote(
      [{ kind: "copies", mode: "BW", sides: "SINGLE", totalPages: 250, quantitySets: 1, paper: "24LB" }],
      pricing
    );
    const scan10 = calculatePrintShopQuote(
      [{ kind: "scanning", totalPages: 10 }],
      pricing
    );

    expect(copy40.totalCents).toBe(600);
    expect(copy250.totalCents).toBe(2750);
    expect(scan10.totalCents).toBe(250);
  });
});
