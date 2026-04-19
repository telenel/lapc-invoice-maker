import type { ProductFilters, Product } from "./types";

type ExplanationProduct = Pick<
  Product,
  | "stock_on_hand"
  | "units_sold_30d"
  | "units_sold_1y"
  | "margin_ratio"
  | "stock_coverage_days"
  | "trend_direction"
  | "discontinued"
>;

export function getCoverageBand(
  days: number | null | undefined,
): "critical" | "low" | "healthy" | "overstocked" | "unknown" {
  if (days == null) return "unknown";
  if (days < 14) return "critical";
  if (days < 30) return "low";
  if (days <= 180) return "healthy";
  return "overstocked";
}

export function getRecommendedAction(product: Pick<
  Product,
  "stock_on_hand" | "units_sold_30d" | "units_sold_1y" | "margin_ratio" | "stock_coverage_days" | "discontinued"
>): string {
  const stock = Number(product.stock_on_hand ?? 0);
  const units30d = Number(product.units_sold_30d ?? 0);
  const units1y = Number(product.units_sold_1y ?? 0);
  const marginRatio = Number(product.margin_ratio ?? 1);

  if (stock <= 2 && units30d >= 5) return "Reorder";
  if (units1y === 0 && stock > 0) return "Clearance";
  if (marginRatio < 0.1 && units1y >= 100) return "Review Price";
  if (product.discontinued && units1y > 0) return "Review Discontinue";
  return "Monitor";
}

export function buildProductExplanationChips(
  product: ExplanationProduct,
  filters: ProductFilters,
): string[] {
  const chips: string[] = [];

  if (filters.maxStock !== "") chips.push(`Stock <= ${filters.maxStock}`);
  if (filters.minStock !== "") chips.push(`Stock >= ${filters.minStock}`);

  if (filters.unitsSoldWindow === "30d" && (filters.minUnitsSold !== "" || filters.maxUnitsSold !== "")) {
    chips.push(`30d units: ${Number(product.units_sold_30d ?? 0)}`);
  }
  if (filters.unitsSoldWindow === "1y" && (filters.minUnitsSold !== "" || filters.maxUnitsSold !== "")) {
    chips.push(`1y units: ${Number(product.units_sold_1y ?? 0)}`);
  }
  if (filters.trendDirection !== "" && product.trend_direction) {
    chips.push(`Trend: ${product.trend_direction}`);
  }
  if (filters.maxMargin !== "" || filters.minMargin !== "") {
    chips.push(`Margin: ${Math.round(Number(product.margin_ratio ?? 0) * 100)}%`);
  }

  const coverageBand = getCoverageBand(product.stock_coverage_days);
  if (coverageBand !== "unknown") {
    chips.push(`Coverage: ${coverageBand}`);
  }

  return chips;
}
