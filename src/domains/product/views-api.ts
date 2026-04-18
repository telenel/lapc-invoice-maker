import type { ColumnPreferences, SavedView } from "./types";

interface ListResponse {
  system: SavedView[];
  mine: SavedView[];
}

export async function listViews(): Promise<ListResponse> {
  const res = await fetch("/api/products/views", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/products/views → ${res.status}`);
  return (await res.json()) as ListResponse;
}

export interface SaveViewInput {
  name: string;
  description?: string | null;
  filter: Record<string, unknown>;
  columnPreferences?: ColumnPreferences | null;
}

export async function saveView(input: SaveViewInput): Promise<SavedView> {
  const res = await fetch("/api/products/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body.error as string) ?? "Duplicate view name");
  }
  if (!res.ok) throw new Error(`POST /api/products/views → ${res.status}`);
  return (await res.json()) as SavedView;
}

export async function deleteView(id: string): Promise<void> {
  const res = await fetch(`/api/products/views/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/products/views/${id} → ${res.status}`);
}

export interface DccListItem {
  deptNum: number;
  classNum: number | null;
  catNum: number | null;
  deptName: string | null;
  className: string | null;
  catName: string | null;
}

let dccCache: Promise<DccListItem[]> | null = null;

export function loadDccList(): Promise<DccListItem[]> {
  if (!dccCache) {
    dccCache = fetch("/api/products/dcc-list")
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/products/dcc-list → ${r.status}`);
        return r.json();
      })
      .then((body: { items: DccListItem[] }) => body.items)
      .catch((e) => {
        dccCache = null; // allow retry next call
        throw e;
      });
  }
  return dccCache;
}
