import { Suspense } from "react";
import ProductsPageClient from "@/components/products/products-page-client";

function ProductsPageFallback() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-0.5 h-3 w-56 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-9 w-64 rounded bg-muted motion-safe:animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
          <div className="h-9 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="mb-2.5 h-12 rounded-[10px] border border-border bg-card" />
      <div className="flex items-start gap-3">
        <div className="hidden h-96 w-56 rounded-[10px] border border-border bg-card md:block" />
        <div className="min-w-0 flex-1 rounded-[10px] border border-border bg-card">
          <div className="h-12 border-b border-border bg-muted/40" />
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="h-10 rounded bg-muted/70 motion-safe:animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsPageFallback />}>
      <ProductsPageClient />
    </Suspense>
  );
}
