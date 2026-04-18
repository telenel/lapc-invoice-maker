import { describe, expect, it } from "vitest";
import { applyPreset } from "@/domains/product/view-serializer";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import type { Product, ProductFilters } from "@/domains/product/types";

// Minimal fixture covering each preset's decision surface.
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const years = (y: number) => new Date(now.getTime() - y * 365 * 86400000).toISOString();
const base = (p: Partial<Product>): Product => ({
  sku: 0, barcode: null, item_type: "general_merchandise", description: "x", author: null,
  title: null, isbn: null, edition: null, retail_price: 10, cost: 5, stock_on_hand: 10,
  catalog_number: null, vendor_id: 1, dcc_id: 1, product_type: null, color_id: 0,
  created_at: null, updated_at: daysAgo(30), last_sale_date: daysAgo(30),
  synced_at: daysAgo(30), dept_num: null, class_num: null, cat_num: null,
  dept_name: null, class_name: null, cat_name: null,
  units_sold_30d: 0,
  units_sold_90d: 0,
  units_sold_1y: 0,
  units_sold_3y: 0,
  units_sold_lifetime: 0,
  revenue_30d: 0,
  revenue_90d: 0,
  revenue_1y: 0,
  revenue_3y: 0,
  revenue_lifetime: 0,
  txns_1y: 0,
  txns_lifetime: 0,
  first_sale_date_computed: null,
  last_sale_date_computed: null,
  sales_aggregates_computed_at: null,
  discontinued: false,
  ...p,
});

const fixtures: Product[] = [
  base({ sku: 1, description: "Sold recently", last_sale_date: daysAgo(5) }),
  base({ sku: 2, description: "Never sold", last_sale_date: null }),
  base({ sku: 3, description: "Discontinued with stock", discontinued: true, stock_on_hand: 5 }),
  base({ sku: 4, description: "Discontinued zero stock", discontinued: true, stock_on_hand: 0, last_sale_date: null }),
  base({ sku: 5, description: "No barcode", barcode: null }),
  base({ sku: 6, description: "Has barcode", barcode: "12345" }),
  base({ sku: 7, item_type: "textbook", title: null, isbn: null, description: null }),
  base({ sku: 8, item_type: "textbook", title: "T", isbn: "978", description: null }),
  base({ sku: 9, description: "Negative margin", retail_price: 5, cost: 10 }),
  base({ sku: 10, description: "Zero retail", retail_price: 0 }),
  base({ sku: 11, description: "Old sale", last_sale_date: years(3) }),
  base({ sku: 12, description: "Very old", last_sale_date: years(6) }),
  base({ sku: 13, description: "Expensive textbook", item_type: "textbook", title: "Big", retail_price: 150, cost: 50 }),
  base({ sku: 14, description: "Cheap merch", retail_price: 3, cost: 1 }),
  base({ sku: 15, description: "Thin margin", retail_price: 100, cost: 95 }),
  base({ sku: 16, description: "High margin", retail_price: 100, cost: 20 }),
  base({ sku: 17, description: "Recently edited", updated_at: daysAgo(2) }),
  base({ sku: 18, description: "Edited post-sync", updated_at: daysAgo(1), synced_at: daysAgo(5) }),
  base({ sku: 19, item_type: "used_textbook", description: "Used copy" }),
  base({ sku: 20, description: "Top unit seller 30d", units_sold_30d: 200, units_sold_1y: 2000, units_sold_lifetime: 5000, txns_1y: 300, txns_lifetime: 1200, revenue_30d: 1000, revenue_1y: 9000, last_sale_date_computed: daysAgo(1) }),
  base({ sku: 21, description: "Revenue champ 1y", revenue_1y: 50000, units_sold_1y: 500, txns_1y: 300 }),
  base({ sku: 22, description: "Consistent seller", txns_1y: 80, units_sold_1y: 400 }),
  base({ sku: 23, description: "One-hit wonder", txns_lifetime: 1, units_sold_lifetime: 20 }),
  base({ sku: 24, description: "Accelerating", units_sold_30d: 30, units_sold_1y: 100 }),
  base({ sku: 25, description: "Decelerating", units_sold_30d: 1, units_sold_1y: 100 }),
  base({ sku: 26, description: "New arrival", first_sale_date_computed: daysAgo(30), units_sold_30d: 10 }),
  base({ sku: 27, description: "Overstocked", stock_on_hand: 500, units_sold_1y: 20 }),
  base({ sku: 28, description: "Stockout risk", stock_on_hand: 2, units_sold_30d: 15 }),
  base({ sku: 29, description: "Authoritative dead", txns_lifetime: 0, stock_on_hand: 5 }),
  base({ sku: 30, description: "Textbook this semester", item_type: "textbook", title: "Calc", units_sold_90d: 20 }),
  base({ sku: 31, description: "High margin popular", retail_price: 100, cost: 40, units_sold_1y: 100 }),
  base({ sku: 32, description: "High margin dead", retail_price: 100, cost: 40, units_sold_1y: 0 }),
];

function matchesFilter(p: Product, f: ProductFilters): boolean {
  // Minimal mirror of searchProducts' predicate logic — only the keys that
  // system presets actually use. Kept in sync with queries.ts.
  if (f.tab === "textbooks" && !["textbook", "used_textbook"].includes(p.item_type)) return false;
  if (f.tab === "merchandise" && !["general_merchandise", "supplies", "other"].includes(p.item_type)) return false;
  if (f.minPrice !== "" && p.retail_price < Number(f.minPrice)) return false;
  if (f.maxPrice !== "" && p.retail_price > Number(f.maxPrice)) return false;
  if (f.minStock !== "" && (p.stock_on_hand ?? 0) < Number(f.minStock)) return false;
  if (f.maxStock !== "" && (p.stock_on_hand ?? 0) > Number(f.maxStock)) return false;
  if (f.missingBarcode && p.barcode !== null) return false;
  if (f.missingIsbn && p.isbn !== null) return false;
  if (f.missingTitle) {
    const isTb = ["textbook", "used_textbook"].includes(p.item_type);
    const isGm = p.item_type === "general_merchandise";
    const missing = (isTb && p.title === null) || (isGm && p.description === null);
    if (!missing) return false;
  }
  if (f.retailBelowCost && !(p.retail_price < p.cost)) return false;
  if (f.zeroPrice && !(p.retail_price === 0 || p.cost === 0)) return false;
  if (f.lastSaleNever && p.last_sale_date !== null) return false;
  if (f.lastSaleWithin !== "") {
    const days = f.lastSaleWithin === "30d" ? 30 : f.lastSaleWithin === "90d" ? 90 : 365;
    if (!p.last_sale_date) return false;
    if (new Date(p.last_sale_date).getTime() < now.getTime() - days * 86400000) return false;
  }
  if (f.lastSaleOlderThan !== "") {
    const y = f.lastSaleOlderThan === "2y" ? 2 : 5;
    if (!p.last_sale_date) return false;
    if (new Date(p.last_sale_date).getTime() >= now.getTime() - y * 365 * 86400000) return false;
  }
  if (f.editedWithin === "7d") {
    if (new Date(p.updated_at).getTime() < now.getTime() - 7 * 86400000) return false;
  }
  if (f.editedSinceSync) {
    if (new Date(p.updated_at).getTime() <= new Date(p.synced_at).getTime()) return false;
  }
  if (f.discontinued === "yes" && !p.discontinued) return false;
  if (f.discontinued === "no" && p.discontinued) return false;
  if (f.itemType !== "" && p.item_type !== f.itemType) return false;
  if (f.minMargin !== "" || f.maxMargin !== "") {
    if (p.retail_price <= 0) return false;
    const m = (p.retail_price - p.cost) / p.retail_price;
    if (f.minMargin !== "" && m < Number(f.minMargin)) return false;
    if (f.maxMargin !== "" && m > Number(f.maxMargin)) return false;
  }
  if (f.neverSoldLifetime && (p.txns_lifetime ?? 0) > 0) return false;
  if (f.unitsSoldWindow !== "") {
    const col = (`units_sold_${f.unitsSoldWindow}` as const) as keyof Product;
    const v = (p[col] as number | null) ?? 0;
    if (f.minUnitsSold !== "" && v < Number(f.minUnitsSold)) return false;
    if (f.maxUnitsSold !== "" && v > Number(f.maxUnitsSold)) return false;
  }
  if (f.revenueWindow !== "") {
    const col = (`revenue_${f.revenueWindow}` as const) as keyof Product;
    const v = (p[col] as number | null) ?? 0;
    if (f.minRevenue !== "" && v < Number(f.minRevenue)) return false;
    if (f.maxRevenue !== "" && v > Number(f.maxRevenue)) return false;
  }
  if (f.txnsWindow !== "") {
    const col = (`txns_${f.txnsWindow}` as const) as keyof Product;
    const v = (p[col] as number | null) ?? 0;
    if (f.minTxns !== "" && v < Number(f.minTxns)) return false;
    if (f.maxTxns !== "" && v > Number(f.maxTxns)) return false;
  }
  if (f.firstSaleWithin !== "") {
    const days = f.firstSaleWithin === "90d" ? 90 : 365;
    if (!p.first_sale_date_computed) return false;
    if (new Date(p.first_sale_date_computed).getTime() < now.getTime() - days * 86400000) return false;
  }
  if (f.trendDirection === "accelerating") {
    const r30 = (p.units_sold_30d ?? 0) / 30;
    const r1y = (p.units_sold_1y ?? 0) / 365;
    if (!(r1y > 0 && r30 > r1y * 1.5)) return false;
  }
  if (f.trendDirection === "decelerating") {
    const r30 = (p.units_sold_30d ?? 0) / 30;
    const r1y = (p.units_sold_1y ?? 0) / 365;
    if (!(r1y > 0 && r30 < r1y * 0.5)) return false;
  }
  if (f.maxStockCoverageDays !== "") {
    const rate30 = (p.units_sold_30d ?? 0) / 30;
    if (rate30 === 0) return false;
    const cover = (p.stock_on_hand ?? 0) / rate30;
    if (cover > Number(f.maxStockCoverageDays)) return false;
  }
  return true;
}

describe.each(SYSTEM_PRESET_VIEWS)("preset $slug", (preset) => {
  it("runs cleanly over the fixture and returns deterministic set", () => {
    const { filters } = applyPreset(preset);
    const matched = fixtures.filter((p) => matchesFilter(p, filters)).map((p) => p.sku).sort((a, b) => a - b);
    expect(Array.isArray(matched)).toBe(true);
    expect(matched).toMatchSnapshot();
  });
});
