"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BatchAddGrid } from "@/components/products/batch-add-grid";
import { getPrimaryProductLocationId, parseProductLocationIdsParam } from "@/domains/product/location-filters";

export default function BatchAddPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationIds = parseProductLocationIdsParam(searchParams.get("loc"));
  const primaryLocationId = getPrimaryProductLocationId(locationIds);
  return (
    <div className="page-enter page-enter-1 mx-auto max-w-7xl px-4 py-6">
      <BatchAddGrid
        locationIds={locationIds}
        primaryLocationId={primaryLocationId}
        onSubmitted={(skus) => {
          router.push(`/products?highlight=${skus.join(",")}`);
        }}
      />
    </div>
  );
}
