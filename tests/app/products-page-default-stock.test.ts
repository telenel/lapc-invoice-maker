import { describe, expect, it } from "vitest";
import { shouldApplyDefaultMinStock } from "@/domains/product/page-defaults";

describe("shouldApplyDefaultMinStock", () => {
  it("applies the baseline on the plain catalog landing page", () => {
    expect(
      shouldApplyDefaultMinStock(new URLSearchParams(), false, ""),
    ).toBe(true);
  });

  it("does not inject the baseline for view URLs", () => {
    expect(
      shouldApplyDefaultMinStock(new URLSearchParams("view=dead-never-sold-authoritative"), true, ""),
    ).toBe(false);
  });

  it("respects explicit minStock params", () => {
    expect(
      shouldApplyDefaultMinStock(new URLSearchParams("minStock=0"), false, ""),
    ).toBe(false);
  });
});
