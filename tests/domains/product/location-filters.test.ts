import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_LOCATION_IDS,
  getPrimaryProductLocationId,
  normalizeProductLocationIds,
  parseProductLocationIdsParam,
  serializeProductLocationIdsParam,
} from "@/domains/product/location-filters";

describe("location-filters", () => {
  it("exports the Pierce default location ids in canonical order", () => {
    expect(DEFAULT_PRODUCT_LOCATION_IDS).toEqual([2, 3, 4]);
  });

  it("normalizes ids to the canonical Pierce order", () => {
    expect(normalizeProductLocationIds([4, 2, 3])).toEqual([2, 3, 4]);
  });

  it("drops duplicates and invalid ids while preserving canonical order", () => {
    expect(normalizeProductLocationIds([4, 99, 4, 3, 1, 2, 2])).toEqual([2, 3, 4]);
  });

  it("falls back to the defaults when no valid location ids remain", () => {
    expect(normalizeProductLocationIds([0, 1, 5, 99])).toEqual(DEFAULT_PRODUCT_LOCATION_IDS);
  });

  it("parses location ids from the loc query param", () => {
    expect(parseProductLocationIdsParam("4,2")).toEqual([2, 4]);
  });

  it("falls back to defaults when the loc query param is missing or invalid", () => {
    expect(parseProductLocationIdsParam(null)).toEqual(DEFAULT_PRODUCT_LOCATION_IDS);
    expect(parseProductLocationIdsParam("pierce,99")).toEqual(DEFAULT_PRODUCT_LOCATION_IDS);
  });

  it("serializes location ids in canonical order", () => {
    expect(serializeProductLocationIdsParam([4, 2])).toBe("2,4");
  });

  it("returns the primary location id from the normalized set", () => {
    expect(getPrimaryProductLocationId([4, 3])).toBe(3);
    expect(getPrimaryProductLocationId(DEFAULT_PRODUCT_LOCATION_IDS)).toBe(2);
  });
});
