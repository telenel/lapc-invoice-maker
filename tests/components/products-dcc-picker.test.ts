import { describe, expect, it } from "vitest";
import {
  findCommittedDccMatch,
  findExactDccMatch,
  getPartialDccPatch,
} from "@/components/products/dcc-picker";

describe("findExactDccMatch", () => {
  const items = [
    { deptNum: 10, classNum: 20, catNum: 30, deptName: "Drinks", className: "Cold", catName: "Soda" },
    { deptNum: 10, classNum: 20, catNum: 31, deptName: "Drinks", className: "Cold", catName: "Water" },
  ];

  it("matches only an exact DCC code", () => {
    expect(findExactDccMatch(items, "10.20.30")).toEqual(items[0]);
    expect(findExactDccMatch(items, "10.20")).toBeNull();
    expect(findExactDccMatch(items, "drinks")).toBeNull();
  });

  it("preserves incremental numeric DCC filters", () => {
    expect(getPartialDccPatch("10.20")).toEqual({
      deptNum: "10",
      classNum: "20",
      catNum: "",
    });
    expect(getPartialDccPatch("")).toEqual({
      deptNum: "",
      classNum: "",
      catNum: "",
    });
    expect(getPartialDccPatch("drinks")).toBeNull();
  });

  it("only auto-commits a unique name match on blur", () => {
    expect(findCommittedDccMatch(items, "water")).toEqual(items[1]);
    expect(findCommittedDccMatch(items, "drinks")).toBeNull();
    expect(findCommittedDccMatch(items, "10.20.30")).toEqual(items[0]);
  });
});
