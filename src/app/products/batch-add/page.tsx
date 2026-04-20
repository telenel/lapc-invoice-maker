"use client";

import { useRouter } from "next/navigation";
import { BatchAddGrid } from "@/components/products/batch-add-grid";
import { PrismWriteWarningBanner } from "@/components/products/prism-write-warning-banner";

export default function BatchAddPage() {
  const router = useRouter();
  return (
    <div className="page-enter page-enter-1 mx-auto max-w-7xl space-y-4 px-4 py-6">
      <PrismWriteWarningBanner
        messages={[
          "Batch add creates live Prism/POS catalog items.",
          "The final submit step now requires explicit human confirmation.",
          "Double-check rows before submitting because the changes are not a draft.",
        ]}
      />
      <BatchAddGrid
        onSubmitted={(skus) => {
          router.push(`/products?highlight=${skus.join(",")}`);
        }}
      />
    </div>
  );
}
