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

  it("coerces boolean keys from 'true'/'false'", () => {
    const out = parseFiltersFromSearchParams(makeParams({ missingBarcode: "true", lastSaleNever: "true" }));
    expect(out.missingBarcode).toBe(true);
    expect(out.lastSaleNever).toBe(true);
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
  it("returns the preset filter merged over defaults and preserves empty keys", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-never-sold")!;
    const result = applyPreset(preset);
    expect(result.filters.lastSaleNever).toBe(true);
    expect(result.filters.tab).toBe(EMPTY_FILTERS.tab);
  });

  it("returns the preset column preferences", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-discontinued-with-stock")!;
    const result = applyPreset(preset);
    expect(result.visibleColumns).toEqual(["stock", "updated"]);
  });
});
