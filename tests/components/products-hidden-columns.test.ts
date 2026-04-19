import { describe, expect, it } from "vitest";
import { getHiddenTiersForWidth } from "@/components/products/use-hidden-columns";

describe("getHiddenTiersForWidth", () => {
  it("hides low-priority columns at exactly 1280px", () => {
    expect(getHiddenTiersForWidth(1280)).toEqual(["low"]);
  });

  it("hides both low and medium priority columns at exactly 1024px", () => {
    expect(getHiddenTiersForWidth(1024)).toEqual(["low", "medium"]);
  });
});
