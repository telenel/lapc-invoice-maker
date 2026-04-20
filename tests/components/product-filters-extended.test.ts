import { describe, expect, it } from "vitest";
import { getLastSaleNeverPatch } from "@/components/products/product-filters-extended";

describe("getLastSaleNeverPatch", () => {
  it("clears conflicting sale-state filters when enabled", () => {
    expect(getLastSaleNeverPatch(true)).toEqual({
      lastSaleNever: true,
      lastSaleWithin: "",
      lastSaleOlderThan: "",
      lastSaleDateFrom: "",
      lastSaleDateTo: "",
    });
  });

  it("only disables the checkbox when turned off", () => {
    expect(getLastSaleNeverPatch(false)).toEqual({
      lastSaleNever: false,
    });
  });
});
