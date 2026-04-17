import { describe, it, expect } from "vitest";
import {
  parsePastedGrid,
  computeMargin,
} from "@/components/products/batch-add-grid";

describe("parsePastedGrid", () => {
  it("splits a simple 2x2 TSV", () => {
    const out = parsePastedGrid("a\tb\nc\td");
    expect(out).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles Excel CRLF line endings", () => {
    const out = parsePastedGrid("a\tb\r\nc\td\r\n");
    expect(out).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("tolerates trailing tab/newline", () => {
    const out = parsePastedGrid("a\tb\t\nc\td\n");
    expect(out).toEqual([["a", "b", ""], ["c", "d"]]);
  });

  it("returns empty array for empty input", () => {
    expect(parsePastedGrid("")).toEqual([]);
    expect(parsePastedGrid("\n")).toEqual([]);
  });
});

describe("computeMargin", () => {
  it("returns idle tone with null pct when retail is blank", () => {
    expect(computeMargin("5", "")).toEqual({ pct: null, tone: "idle" });
  });

  it("returns idle tone when retail is zero or negative", () => {
    expect(computeMargin("5", "0")).toEqual({ pct: null, tone: "idle" });
    expect(computeMargin("5", "-1")).toEqual({ pct: null, tone: "idle" });
  });

  it("returns good tone when margin is 30% or greater", () => {
    const result = computeMargin("5", "10");
    expect(result.pct).toBeCloseTo(50, 5);
    expect(result.tone).toBe("good");
  });

  it("returns warn tone between 10% and 30%", () => {
    const result = computeMargin("8.5", "10");
    expect(result.pct).toBeCloseTo(15, 5);
    expect(result.tone).toBe("warn");
  });

  it("returns bad tone below 10%", () => {
    const result = computeMargin("9.5", "10");
    expect(result.pct).toBeCloseTo(5, 5);
    expect(result.tone).toBe("bad");
  });

  it("returns bad tone when cost exceeds retail (negative margin)", () => {
    const result = computeMargin("12", "10");
    expect(result.pct).toBeCloseTo(-20, 5);
    expect(result.tone).toBe("bad");
  });

  it("treats boundary at exactly 30% as good", () => {
    const result = computeMargin("7", "10");
    expect(result.pct).toBeCloseTo(30, 5);
    expect(result.tone).toBe("good");
  });

  it("treats boundary at exactly 10% as warn", () => {
    const result = computeMargin("9", "10");
    expect(result.pct).toBeCloseTo(10, 5);
    expect(result.tone).toBe("warn");
  });

  it("returns idle when cost is non-numeric", () => {
    expect(computeMargin("abc", "10")).toEqual({ pct: null, tone: "idle" });
  });

  it("returns idle when retail is non-numeric", () => {
    expect(computeMargin("5", "abc")).toEqual({ pct: null, tone: "idle" });
  });

  it("rejects negative cost", () => {
    expect(computeMargin("-1", "10")).toEqual({ pct: null, tone: "idle" });
  });
});
