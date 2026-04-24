"use client";

export { buildProductQueryPlan, hasAnalyticsProductFilters } from "./query-plan";
import type {
  ProductBrowseCountResult,
  ProductBrowseSearchResult,
  ProductFilters,
} from "./types";
import { serializeFiltersToSearchParams } from "./view-serializer";

export interface SearchProductsOptions {
  /** When true, the query skips selecting row data and returns only the count. */
  countOnly?: boolean;
  signal?: AbortSignal;
}

type ProductRouteSearchResult = ProductBrowseSearchResult | ProductBrowseCountResult;

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
  options: SearchProductsOptions & { countOnly: true },
): Promise<ProductBrowseCountResult>;
export async function searchProducts(
  filters: ProductFilters,
  options?: SearchProductsOptions,
): Promise<ProductBrowseSearchResult>;
export async function searchProducts(
  filters: ProductFilters,
  options: SearchProductsOptions = {},
): Promise<ProductRouteSearchResult> {
  const params = serializeFiltersToSearchParams(filters);
  if (options.countOnly) {
    params.set("countOnly", "true");
  }
  const query = params.toString();
  const url = query ? `/api/products/search?${query}` : "/api/products/search";

  const response = await fetch(url, {
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readSearchError(response));
  }

  const result = await response.json() as ProductRouteSearchResult;

  if (!options.countOnly) {
    return result;
  }

  return result as ProductBrowseCountResult;
}
