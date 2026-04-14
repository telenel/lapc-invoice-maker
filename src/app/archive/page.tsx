import { ArchivePageClient } from "@/components/archive/archive-page-client";

export default function ArchivePage() {
  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Deleted Archive</h1>
        <p className="text-sm text-muted-foreground">
          Restore quotes and invoices you previously deleted.
        </p>
      </div>
      <ArchivePageClient />
    </main>
  );
}
