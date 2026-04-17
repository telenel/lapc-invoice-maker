import { describe, it, expect } from "vitest";
import { parsePastedGrid } from "@/components/products/batch-add-grid";

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
