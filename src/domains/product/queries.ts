"use client";

import { PAGE_SIZE } from "./constants";
export { buildProductQueryPlan, hasAnalyticsProductFilters } from "./query-plan";
import type { ProductFilters, ProductSearchResult } from "./types";
import { serializeFiltersToSearchParams } from "./view-serializer";

export interface SearchProductsOptions {
  /** When true, the query skips selecting row data and returns only the count. */
  countOnly?: boolean;
}

async function readSearchError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string; message?: string };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
    if (typeof body.message === "string" && body.message.trim()) return body.message;
  } catch {
    // Fall through to the generic status text below when the response is not JSON.
  }

  return response.statusText || "Failed to search products";
}

export async function searchProducts(
  filters: ProductFilters,
  options: SearchProductsOptions = {},
): Promise<ProductSearchResult> {
  const params = serializeFiltersToSearchParams(filters);
  const query = params.toString();
  const url = query ? `/api/products/search?${query}` : "/api/products/search";

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readSearchError(response));
  }

  const result = await response.json() as ProductSearchResult;

  if (!options.countOnly) {
    return result;
  }

  return {
    products: [],
    total: result.total,
    page: result.page ?? filters.page,
    pageSize: result.pageSize ?? PAGE_SIZE,
  };
}
