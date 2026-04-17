"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BatchAddGrid } from "@/components/products/batch-add-grid";
import { Button } from "@/components/ui/button";

export default function BatchAddPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Batch add items</h1>
          <p className="text-sm text-muted-foreground">
            Paste from Excel or type rows directly. Validate before submitting — all rows must pass before any are written.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/products" />}>
          Back to products
        </Button>
      </div>

      <BatchAddGrid
        onSubmitted={(skus) => {
          router.push(`/products?highlight=${skus.join(",")}`);
        }}
      />
    </div>
  );
}
