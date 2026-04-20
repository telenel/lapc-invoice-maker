import { describe, expect, it } from "vitest";
import { findExactDccMatch } from "@/components/products/dcc-picker";

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
});
