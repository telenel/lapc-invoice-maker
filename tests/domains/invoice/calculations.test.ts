// tests/domains/invoice/calculations.test.ts
import { describe, it, expect } from "vitest";
import { calculateLineItems, calculateTotal } from "@/domains/invoice/calculations";

describe("calculateLineItems", () => {
  it("computes extendedPrice for each item", () => {
    const items = [
      { description: "Widget", quantity: 3, unitPrice: 10.5 },
      { description: "Gadget", quantity: 1, unitPrice: 25 },
    ];
    const result = calculateLineItems(items);
    expect(result[0].extendedPrice).toBe(31.5);
    expect(result[1].extendedPrice).toBe(25);
  });

  it("handles string inputs (Prisma Decimal)", () => {
    const items = [
      { description: "Item", quantity: "2" as unknown as number, unitPrice: "15.50" as unknown as number },
    ];
    const result = calculateLineItems(items);
    expect(result[0].extendedPrice).toBe(31);
  });

  it("returns empty array for empty input", () => {
    expect(calculateLineItems([])).toEqual([]);
  });

  it("assigns sortOrder from index when not provided", () => {
    const items = [
      { description: "A", quantity: 1, unitPrice: 10 },
      { description: "B", quantity: 1, unitPrice: 20 },
    ];
    const result = calculateLineItems(items);
    expect(result[0].sortOrder).toBe(0);
    expect(result[1].sortOrder).toBe(1);
  });

  it("preserves explicit sortOrder", () => {
    const items = [
      { description: "A", quantity: 1, unitPrice: 10, sortOrder: 5 },
    ];
    const result = calculateLineItems(items);
    expect(result[0].sortOrder).toBe(5);
  });
});

describe("calculateTotal", () => {
  it("sums extendedPrices", () => {
    const items = [
      { description: "A", quantity: 1, unitPrice: 10, extendedPrice: 10, sortOrder: 0 },
      { description: "B", quantity: 2, unitPrice: 5, extendedPrice: 10, sortOrder: 1 },
    ];
    expect(calculateTotal(items)).toBe(20);
  });

  it("handles Decimal strings in extendedPrice", () => {
    const items = [
      { description: "A", quantity: 1, unitPrice: 10, extendedPrice: "15.50" as unknown as number, sortOrder: 0 },
    ];
    expect(calculateTotal(items)).toBe(15.5);
  });

  it("returns 0 for empty array", () => {
    expect(calculateTotal([])).toBe(0);
  });
});
