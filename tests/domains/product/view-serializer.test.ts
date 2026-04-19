import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import type { ProductFilters } from "@/domains/product/types";
import {
  applyPreset,
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
} from "@/domains/product/view-serializer";

function makeParams(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

describe("serializeFiltersToSearchParams", () => {
  it("emits only non-default keys", () => {
    const filters: ProductFilters = { ...EMPTY_FILTERS, tab: "merchandise", minPrice: "5" };
    const params = serializeFiltersToSearchParams(filters);
    expect(params.get("tab")).toBe("merchandise");
    expect(params.get("minPrice")).toBe("5");
    expect(params.get("search")).toBeNull();
    expect(params.get("page")).toBeNull();
  });

  it("includes view param when explicitly passed", () => {
    const filters: ProductFilters = { ...EMPTY_FILTERS };
    const params = serializeFiltersToSearchParams(filters, { view: "dead-never-sold" });
    expect(params.get("view")).toBe("dead-never-sold");
  });
});

describe("parseFiltersFromSearchParams", () => {
  it("is the inverse of serialize for non-default keys", () => {
    const filters: ProductFilters = { ...EMPTY_FILTERS, tab: "merchandise", minStock: "1", discontinued: "yes" };
    const roundtripped = parseFiltersFromSearchParams(serializeFiltersToSearchParams(filters));
    expect(roundtripped).toEqual(filters);
  });

  it("round-trips analytics and derived preset filters through the URL", () => {
    const filters: ProductFilters = {
      ...EMPTY_FILTERS,
      unitsSoldWindow: "1y",
      minUnitsSold: "10",
      maxUnitsSold: "50",
      revenueWindow: "lifetime",
      minRevenue: "100",
      maxRevenue: "500",
      txnsWindow: "1y",
      minTxns: "5",
      maxTxns: "25",
      neverSoldLifetime: true,
      firstSaleWithin: "90d",
      trendDirection: "accelerating",
      maxStockCoverageDays: "30",
    };

    const roundtripped = parseFiltersFromSearchParams(serializeFiltersToSearchParams(filters));
    expect(roundtripped).toEqual(filters);
  });

  it("coerces boolean keys from 'true'/'false'", () => {
    const out = parseFiltersFromSearchParams(makeParams({
      missingBarcode: "true",
      lastSaleNever: "true",
      neverSoldLifetime: "true",
    }));
    expect(out.missingBarcode).toBe(true);
    expect(out.lastSaleNever).toBe(true);
    expect(out.neverSoldLifetime).toBe(true);
  });

  it("drops invalid numeric values silently", () => {
    const out = parseFiltersFromSearchParams(makeParams({ minStock: "NaN", maxStock: "abc" }));
    expect(out.minStock).toBe("");
    expect(out.maxStock).toBe("");
  });

  it("ignores unknown keys without throwing", () => {
    const out = parseFiltersFromSearchParams(makeParams({ tab: "merchandise", garbage: "???" }));
    expect(out.tab).toBe("merchandise");
  });
});

describe("applyPreset", () => {
  const baseTextbook: ProductFilters = { ...EMPTY_FILTERS, tab: "textbooks", search: "calculus" };
  const baseMerch: ProductFilters = { ...EMPTY_FILTERS, tab: "merchandise", search: "" };

  it("preserves the user's current tab when the preset does not specify one", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "trend-accelerating")!;
    const result = applyPreset(preset, baseMerch);
    expect(result.filters.tab).toBe("merchandise");
    expect(result.filters.trendDirection).toBe("accelerating");
  });

  it("preserves the user's current search when the preset does not specify one", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-never-sold-authoritative")!;
    const result = applyPreset(preset, baseTextbook);
    expect(result.filters.search).toBe("calculus");
    expect(result.filters.neverSoldLifetime).toBe(true);
  });

  it("lets a preset override tab when it sets one explicitly", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "pricing-gm-under-5")!;
    const result = applyPreset(preset, baseTextbook);
    expect(result.filters.tab).toBe("merchandise");
    expect(result.filters.maxPrice).toBe("5");
  });

  it("returns the preset column preferences (filtered to known optional keys)", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-discontinued-with-stock")!;
    const result = applyPreset(preset, baseTextbook);
    // "stock" is permanent now — it gets filtered out of the optional column set.
    expect(result.visibleColumns).toEqual(["updated"]);
  });
});
