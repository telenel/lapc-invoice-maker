import { describe, expect, it } from "vitest";
import {
  isLegacyDefaultColumnSet,
  resolveColumnVisibilityUpdate,
} from "@/components/products/column-visibility-toggle";
import { DEFAULT_COLUMN_SET } from "@/domains/product/constants";

describe("resolveColumnVisibilityUpdate", () => {
  it("keeps persisted defaults unchanged when a preset runtime override is active", () => {
    const base = ["units_1y", "dcc"] as const;
    const runtime = ["units_1y", "dcc", "revenue_1y"] as const;

    const result = resolveColumnVisibilityUpdate(
      [...base],
      [...runtime],
      ["units_1y", "dcc"],
    );

    expect(result.base).toEqual(["units_1y", "dcc"]);
    expect(result.runtime).toEqual(["units_1y", "dcc"]);
  });

  it("updates persisted defaults when no runtime override is active", () => {
    const result = resolveColumnVisibilityUpdate(
      ["units_1y", "dcc"],
      null,
      ["units_1y", "revenue_1y"],
    );

    expect(result.base).toEqual(["units_1y", "revenue_1y"]);
    expect(result.runtime).toBeNull();
  });

  it("keeps the default Products table scan set lean", () => {
    expect(DEFAULT_COLUMN_SET).toEqual(["units_1y", "margin"]);
    expect(DEFAULT_COLUMN_SET).not.toContain("dcc");
  });

  it("detects the previous untouched default for localStorage migration", () => {
    expect(isLegacyDefaultColumnSet(["units_1y", "dcc", "margin"])).toBe(true);
    expect(isLegacyDefaultColumnSet(["dcc", "margin"])).toBe(false);
    expect(isLegacyDefaultColumnSet(["units_1y", "dcc", "margin", "updated"])).toBe(false);
  });
});
