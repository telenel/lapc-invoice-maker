"use client";

import { lazy, Suspense } from "react";
import { PackageIcon } from "lucide-react";

import type { ProductSearchPanelProps } from "./product-search-panel";

const ProductSearchPanel = lazy(() =>
  import("./product-search-panel").then((module) => ({
    default: module.ProductSearchPanel,
  })),
);

function ProductSearchPanelFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading product search"
      className="animate-pulse rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <PackageIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-44 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-10 rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 flex-1 rounded-md bg-muted" />
          <div className="h-8 flex-1 rounded-md bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-14 rounded-md bg-muted/70" />
          <div className="h-14 rounded-md bg-muted/70" />
          <div className="h-14 rounded-md bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

export function LazyProductSearchPanel(props: ProductSearchPanelProps) {
  return (
    <Suspense fallback={<ProductSearchPanelFallback />}>
      <ProductSearchPanel {...props} />
    </Suspense>
  );
}
