import { describe, expect, it } from "vitest";
import { resolveColumnVisibilityUpdate } from "@/components/products/column-visibility-toggle";

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
});
