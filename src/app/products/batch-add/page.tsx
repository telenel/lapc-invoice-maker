"use client";

import { useRouter } from "next/navigation";
import { BatchAddGrid } from "@/components/products/batch-add-grid";

export default function BatchAddPage() {
  const router = useRouter();
  return (
    <div className="page-enter page-enter-1 mx-auto max-w-7xl px-4 py-6">
      <BatchAddGrid
        onSubmitted={(skus) => {
          router.push(`/products?highlight=${skus.join(",")}`);
        }}
      />
    </div>
  );
}
