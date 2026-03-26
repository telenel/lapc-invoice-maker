import { describe, it, expect } from "vitest";
import { escapeCsv, buildCsv } from "@/lib/csv";

// ---------------------------------------------------------------------------
// escapeCsv
// ---------------------------------------------------------------------------

describe("escapeCsv", () => {
  it("returns plain value unchanged when it needs no quoting", () => {
    expect(escapeCsv("hello")).toBe("hello");
  });

  it("wraps value in double quotes when it contains a comma", () => {
    expect(escapeCsv("hello, world")).toBe('"hello, world"');
  });

  it("wraps value in double quotes when it contains a double quote", () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });

  it("doubles embedded double quotes (RFC 4180)", () => {
    expect(escapeCsv('"quoted"')).toBe('"""quoted"""');
  });

  it("wraps value in double quotes when it contains a newline", () => {
    const result = escapeCsv("line1\nline2");
    expect(result).toBe('"line1\nline2"');
  });

  it("wraps value in double quotes when it contains a carriage return", () => {
    const result = escapeCsv("line1\rline2");
    expect(result).toBe('"line1\rline2"');
  });

  it("returns an empty string unchanged", () => {
    expect(escapeCsv("")).toBe("");
  });

  it("handles a value that contains both a comma and double quotes", () => {
    // value: one,"two"
    const result = escapeCsv('one,"two"');
    expect(result).toBe('"one,""two"""');
  });
});

// ---------------------------------------------------------------------------
// buildCsv
// ---------------------------------------------------------------------------

describe("buildCsv", () => {
  it("generates the correct CSV header row", () => {
    const csv = buildCsv(["Invoice Number", "Date", "Total"], []);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe("Invoice Number,Date,Total");
  });

  it("generates a correct data row", () => {
    const csv = buildCsv(
      ["Name", "Amount"],
      [["Jane Doe", "250.00"]]
    );
    const lines = csv.split("\n");
    expect(lines[1]).toBe("Jane Doe,250.00");
  });

  it("escapes header cells that contain commas", () => {
    const csv = buildCsv(["Invoice, Number"], []);
    expect(csv).toBe('"Invoice, Number"');
  });

  it("escapes data cells that contain commas", () => {
    const csv = buildCsv(["Items"], [["Notebooks, Pens"]]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"Notebooks, Pens"');
  });

  it("escapes data cells that contain double quotes", () => {
    const csv = buildCsv(["Note"], [['He said "hello"']]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"He said ""hello"""');
  });

  it("generates multiple data rows correctly", () => {
    const csv = buildCsv(
      ["Number", "Total"],
      [
        ["AG-001", "100.00"],
        ["AG-002", "200.00"],
      ]
    );
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Number,Total");
    expect(lines[1]).toBe("AG-001,100.00");
    expect(lines[2]).toBe("AG-002,200.00");
  });

  it("produces only a header line when rows array is empty", () => {
    const csv = buildCsv(["A", "B", "C"], []);
    expect(csv).toBe("A,B,C");
  });
});
