import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DccPicker,
  findCommittedDccMatch,
  findExactDccMatch,
  getPartialDccPatch,
  getSanitizedFallbackDccPatch,
} from "@/components/products/dcc-picker";

const loadDccListMock = vi.fn();

vi.mock("@/domains/product/views-api", async () => {
  const actual = await vi.importActual<typeof import("@/domains/product/views-api")>(
    "@/domains/product/views-api",
  );

  return {
    ...actual,
    loadDccList: (...args: unknown[]) => loadDccListMock(...args),
  };
});

beforeEach(() => {
  loadDccListMock.mockReset();
});

describe("findExactDccMatch", () => {
  const items = [
    { deptNum: 10, classNum: 20, catNum: 30, deptName: "Drinks", className: "Cold", catName: "Soda" },
    { deptNum: 10, classNum: 20, catNum: 31, deptName: "Drinks", className: "Cold", catName: "Water" },
  ];

  it("matches only an exact DCC code across supported separators", () => {
    expect(findExactDccMatch(items, "10.20.30")).toEqual(items[0]);
    expect(findExactDccMatch(items, "10-20-30")).toEqual(items[0]);
    expect(findExactDccMatch(items, "10 20 30")).toEqual(items[0]);
    expect(findExactDccMatch(items, "10..30")).toBeNull();
    expect(findExactDccMatch(items, "10--30")).toBeNull();
    expect(findExactDccMatch(items, "10.20")).toBeNull();
    expect(findExactDccMatch(items, "drinks")).toBeNull();
  });

  it("preserves incremental numeric DCC filters across separators", () => {
    expect(getPartialDccPatch("10.20")).toEqual({
      deptNum: "10",
      classNum: "20",
      catNum: "",
    });
    expect(getPartialDccPatch("10-20")).toEqual({
      deptNum: "10",
      classNum: "20",
      catNum: "",
    });
    expect(getPartialDccPatch("10 20 30")).toEqual({
      deptNum: "10",
      classNum: "20",
      catNum: "30",
    });
    expect(getPartialDccPatch("10..30")).toEqual({
      deptNum: "10",
      classNum: "",
      catNum: "30",
    });
    expect(getPartialDccPatch("10--30")).toEqual({
      deptNum: "10",
      classNum: "",
      catNum: "30",
    });
    expect(getPartialDccPatch("")).toEqual({
      deptNum: "",
      classNum: "",
      catNum: "",
    });
    expect(getPartialDccPatch("drinks")).toBeNull();
  });

  it("sanitizes fallback DCC input before updating filters", () => {
    expect(getSanitizedFallbackDccPatch("10a-2b 30c")).toEqual({
      deptNum: "10",
      classNum: "2",
      catNum: "30",
    });
    expect(getSanitizedFallbackDccPatch("10--30")).toEqual({
      deptNum: "10",
      classNum: "",
      catNum: "30",
    });
    expect(getSanitizedFallbackDccPatch("drinks")).toEqual({
      deptNum: "",
      classNum: "",
      catNum: "",
    });
  });

  it("only auto-commits a unique name match on blur", () => {
    expect(findCommittedDccMatch(items, "water")).toEqual(items[1]);
    expect(findCommittedDccMatch(items, "drinks")).toBeNull();
    expect(findCommittedDccMatch(items, "10.20.30")).toEqual(items[0]);
    expect(findCommittedDccMatch(items, "10-20-30")).toEqual(items[0]);
    expect(findCommittedDccMatch(items, "10..30")).toBeNull();
  });

  it("uses a text keyboard for fallback composite DCC entry", async () => {
    loadDccListMock.mockRejectedValueOnce(new Error("offline"));

    render(createElement(DccPicker, {
      deptNum: "",
      classNum: "",
      catNum: "",
      onChange: vi.fn(),
    }));

    const input = await screen.findByLabelText("DCC");
    expect(input).toHaveAttribute("inputmode", "text");
  });
});
