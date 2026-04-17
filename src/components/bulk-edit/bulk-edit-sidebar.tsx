"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { savedSearchesApi } from "@/domains/product/api-client";
import type { ProductFilters } from "@/domains/bulk-edit/types";

interface SavedSearch {
  id: string;
  name: string;
  filter: Record<string, unknown>;
  isSystem: boolean;
}

interface BulkEditSidebarProps {
  onLoadFilter: (filter: ProductFilters) => void;
  refreshKey: number;
}

export function BulkEditSidebar({ onLoadFilter, refreshKey }: BulkEditSidebarProps) {
  const [items, setItems] = useState<SavedSearch[]>([]);

  useEffect(() => {
    savedSearchesApi.list().then((res) => setItems(res.items)).catch(() => setItems([]));
  }, [refreshKey]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this saved search?")) return;
    await savedSearchesApi.remove(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const user = items.filter((x) => !x.isSystem);
  const system = items.filter((x) => x.isSystem);

  return (
    <aside aria-label="Saved searches" className="space-y-4 rounded border p-3 text-sm">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Searches</h3>
        {user.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet. Use the Save Search button in the selection panel.</p>
        ) : (
          <ul className="space-y-1">
            {user.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-1">
                <button
                  className="flex-1 truncate rounded px-1 py-0.5 text-left hover:bg-accent"
                  onClick={() => onLoadFilter(s.filter as ProductFilters)}
                >
                  {s.name}
                </button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} aria-label={`Delete ${s.name}`}>x</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Helpers</h3>
        {system.length === 0 ? (
          <p className="text-xs text-muted-foreground">None configured.</p>
        ) : (
          <ul className="space-y-1">
            {system.map((s) => (
              <li key={s.id}>
                <button
                  className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-accent"
                  onClick={() => onLoadFilter(s.filter as ProductFilters)}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
