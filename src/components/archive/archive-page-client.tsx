"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { archiveApi } from "@/domains/archive/api-client";
import { useArchive } from "@/domains/archive/hooks";
import type { ArchiveDocumentType } from "@/domains/archive/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArchiveTable } from "./archive-table";

const TYPE_OPTIONS: Array<{ label: string; value: "all" | ArchiveDocumentType }> = [
  { label: "All", value: "all" },
  { label: "Invoices", value: "INVOICE" },
  { label: "Quotes", value: "QUOTE" },
];

export function ArchivePageClient() {
  const [type, setType] = useState<"all" | ArchiveDocumentType>("all");
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, loading, error, refetch } = useArchive({
    type,
    search: deferredSearch || undefined,
    page: 1,
    pageSize: 20,
  });

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await archiveApi.restore(id);
      toast.success("Document restored");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore document");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={type === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setType(option.value);
                  });
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search document number, department, or recipient"
            className="md:max-w-sm"
          />
        </CardContent>
      </Card>

      <ArchiveTable
        documents={data?.documents ?? []}
        loading={loading}
        error={error}
        restoringId={restoringId}
        onRestore={handleRestore}
      />

      {!loading && !error && data && data.documents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-8 text-center">
            <p className="text-sm font-medium">No deleted documents found.</p>
            <p className="text-sm text-muted-foreground">
              Deleted quotes and invoices will appear here for you to restore at any time.
            </p>
            <div className="pt-2">
              <Link href="/quotes" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to Quotes
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
