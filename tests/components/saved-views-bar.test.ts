import { describe, expect, it } from "vitest";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { getSavedViewsErrorFallback } from "@/components/products/saved-views-bar";

describe("getSavedViewsErrorFallback", () => {
  it("drops stale custom views and resolves to system presets only", () => {
    expect(getSavedViewsErrorFallback()).toEqual({
      system: SYSTEM_PRESET_VIEWS,
      mine: [],
      resolved: SYSTEM_PRESET_VIEWS,
    });
  });
});
