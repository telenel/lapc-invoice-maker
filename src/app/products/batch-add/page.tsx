"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BatchAddGrid } from "@/components/products/batch-add-grid";
import { Button } from "@/components/ui/button";

export default function BatchAddPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="page-enter page-enter-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch add items</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste from Excel or type rows directly. All rows are validated together — nothing is written until every row passes.
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
