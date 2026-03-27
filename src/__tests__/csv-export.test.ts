import { describe, it, expect } from "vitest";
import { escapeCsv, buildCsv } from "@/lib/csv";

describe("escapeCsv", () => {
  it("wraps strings containing commas in quotes", () => {
    expect(escapeCsv("hello, world")).toBe('"hello, world"');
  });

  it("wraps strings containing quotes in quotes and doubles internal quotes", () => {
    expect(escapeCsv('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps strings containing newlines in quotes", () => {
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps strings containing carriage returns in quotes", () => {
    expect(escapeCsv("line1\rline2")).toBe('"line1\rline2"');
  });

  it("returns plain strings unchanged", () => {
    expect(escapeCsv("hello world")).toBe("hello world");
    expect(escapeCsv("simple")).toBe("simple");
    expect(escapeCsv("12345")).toBe("12345");
  });
});

describe("buildCsv", () => {
  it("produces correct header row + data rows", () => {
    const headers = ["Name", "Age", "City"];
    const rows = [
      ["Alice", "30", "LA"],
      ["Bob", "25", "NYC"],
    ];
    const result = buildCsv(headers, rows);
    expect(result).toBe("Name,Age,City\nAlice,30,LA\nBob,25,NYC");
  });

  it("handles empty data array (just headers)", () => {
    const headers = ["Name", "Age"];
    const rows: string[][] = [];
    const result = buildCsv(headers, rows);
    expect(result).toBe("Name,Age");
  });

  it("escapes fields within built CSV", () => {
    const headers = ["Description", "Amount"];
    const rows = [["Widget, Large", "100"]];
    const result = buildCsv(headers, rows);
    expect(result).toBe('Description,Amount\n"Widget, Large",100');
  });
});
