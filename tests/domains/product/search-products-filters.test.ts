import { describe, expect, it } from "vitest";

// The full filter ↔ URL roundtrip lives in view-serializer.test.ts
// (Task 12). This file exists to guard against accidental filter-key
// renames by asserting EMPTY_FILTERS includes every new key.
import { EMPTY_FILTERS } from "@/domains/product/constants";

describe("EMPTY_FILTERS", () => {
  it.each([
    "minStock", "maxStock", "deptNum", "classNum", "catNum",
    "missingBarcode", "missingIsbn", "missingTitle",
    "retailBelowCost", "zeroPrice",
    "minMargin", "maxMargin",
    "lastSaleWithin", "lastSaleNever", "lastSaleOlderThan",
    "editedWithin", "editedSinceSync",
    "discontinued", "itemType",
  ])("includes new filter key: %s", (key) => {
    expect(key in EMPTY_FILTERS).toBe(true);
  });
});
