import type { ColumnPreferences, SavedView } from "./types";

interface ListResponse {
  system: SavedView[];
  mine: SavedView[];
}

async function readApiError(res: Response): Promise<string | null> {
  const body = await res.json().catch(() => null) as { error?: unknown } | null;
  const err = body?.error;
  if (typeof err === "string" && err.trim().length > 0) return err;
  return null;
}

export async function listViews(): Promise<ListResponse> {
  const res = await fetch("/api/products/views", { cache: "no-store" });
  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(
      detail
        ? `GET /api/products/views failed (${res.status}): ${detail}`
        : `GET /api/products/views failed (${res.status})`,
    );
  }
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
    const detail = await readApiError(res);
    throw new Error(detail ?? "Duplicate view name");
  }
  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(
      detail
        ? `POST /api/products/views failed (${res.status}): ${detail}`
        : `POST /api/products/views failed (${res.status})`,
    );
  }
  return (await res.json()) as SavedView;
}

export async function deleteView(id: string): Promise<void> {
  const res = await fetch(`/api/products/views/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(
      detail
        ? `DELETE /api/products/views/${id} failed (${res.status}): ${detail}`
        : `DELETE /api/products/views/${id} failed (${res.status})`,
    );
  }
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
