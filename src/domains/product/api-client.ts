/**
 * Client-side API wrappers for the product write endpoints.
 *
 * These hit the Next.js routes under /api/products which talk to Prism on the
 * backend. They are designed to fail soft when Prism is unreachable (the
 * health endpoint reports `available: false`).
 */

import type {
  GmItemPatch,
  TextbookPatch,
  ItemSnapshot,
  BatchCreateRow,
  BatchValidationError,
  ProductEditDetails,
  ProductEditPatchV2,
} from "./types";
import type { PrismRefs } from "./ref-data";
export type {
  PrismVendorRef,
  PrismDccRef,
  PrismTaxTypeRef,
  PrismTagTypeRef,
  PrismStatusCodeRef,
  PrismPackageTypeRef,
  PrismColorRef,
  PrismBindingRef,
  PrismRefs,
} from "./ref-data";
import type {
  BulkEditRequest,
  PreviewResult,
  CommitResult,
} from "@/domains/bulk-edit/types";

export interface PrismHealth {
  available: boolean;
  configured: boolean;
  reason: string | null;
}

export interface CreateItemInput {
  description: string;
  vendorId: number;
  dccId: number;
  mfgId?: number;
  itemTaxTypeId?: number;
  barcode?: string | null;
  catalogNumber?: string | null;
  comment?: string | null;
  retail: number;
  cost: number;
}

export interface CreatedItem {
  sku: number;
  description: string;
  vendorId: number;
  dccId: number;
  barcode: string | null;
  retail: number;
  cost: number;
}

export interface LegacyUpdateBody {
  patch: GmItemPatch | TextbookPatch;
  isTextbook?: boolean;
  baseline?: ItemSnapshot;
}

export interface V2UpdateBody {
  mode: "v2";
  patch: ProductEditPatchV2;
  baseline?: ItemSnapshot;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    const err = body?.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") return JSON.stringify(err);
  } catch {
    // fall through
  }
  return `${response.status} ${response.statusText}`;
}

export const productApi = {
  async health(): Promise<PrismHealth> {
    const res = await fetch("/api/products/health", { cache: "no-store" });
    if (!res.ok) {
      return { available: false, configured: false, reason: await parseError(res) };
    }
    return (await res.json()) as PrismHealth;
  },

  async refs(): Promise<PrismRefs> {
    const res = await fetch("/api/products/refs");
    if (!res.ok) throw new Error(await parseError(res));
    return (await res.json()) as PrismRefs;
  },

  async create(input: CreateItemInput): Promise<CreatedItem> {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return (await res.json()) as CreatedItem;
  },

  async discontinue(sku: number): Promise<{ sku: number; mode: string; affected: number }> {
    const res = await fetch(`/api/products/${sku}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await parseError(res));
    return (await res.json()) as { sku: number; mode: string; affected: number };
  },

  async detail(sku: number): Promise<ProductEditDetails> {
    const res = await fetch(`/api/products/${sku}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await parseError(res));
    return (await res.json()) as ProductEditDetails;
  },

  async update(
    sku: number,
    body: LegacyUpdateBody | V2UpdateBody,
  ): Promise<{ sku: number; appliedFields: string[] }> {
    const res = await fetch(`/api/products/${sku}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      const data = await res.json();
      const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string; current: unknown };
      err.code = "CONCURRENT_MODIFICATION";
      err.current = data.current;
      throw err;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async hardDelete(sku: number): Promise<{ sku: number; affected: number }> {
    const res = await fetch(`/api/products/${sku}/hard-delete`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async historyCheck(skus: number[]): Promise<Record<string, boolean>> {
    if (skus.length === 0) return {};
    const res = await fetch(`/api/products/history-check?skus=${skus.join(",")}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async validateBatch(
    body:
      | { action: "create"; rows: BatchCreateRow[] }
      | { action: "update"; rows: { sku: number; patch: GmItemPatch | TextbookPatch }[] }
      | { action: "hard-delete"; skus: number[] },
  ): Promise<{ errors: BatchValidationError[] }> {
    const res = await fetch("/api/products/validate-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async batch(
    body:
      | { action: "create"; rows: BatchCreateRow[] }
      | { action: "update"; rows: { sku: number; patch: GmItemPatch | TextbookPatch; isTextbook?: boolean }[] }
      | { action: "discontinue"; skus: number[] }
      | { action: "hard-delete"; skus: number[] },
  ): Promise<{ action: string; count: number; skus: number[] } | { errors: BatchValidationError[] }> {
    const res = await fetch("/api/products/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 400 || res.status === 409) {
      const data = await res.json();
      if (data.errors) return { errors: data.errors };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async bulkEditDryRun(body: BulkEditRequest): Promise<PreviewResult | { errors: unknown[] }> {
    const res = await fetch("/api/products/bulk-edit/dry-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 400) {
      const data = await res.json();
      if (data.errors) return { errors: data.errors };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async bulkEditCommit(body: BulkEditRequest): Promise<CommitResult | { errors: unknown[] }> {
    const res = await fetch("/api/products/bulk-edit/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 400 || res.status === 409) {
      const data = await res.json();
      if (data.errors) return { errors: data.errors };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async listBulkEditRuns(params: { limit?: number; offset?: number } = {}): Promise<{ items: unknown[]; total: number }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    const res = await fetch(`/api/products/bulk-edit/runs?${qs.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getBulkEditRun(id: string): Promise<unknown> {
    const res = await fetch(`/api/products/bulk-edit/runs/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async syncPrismPull(): Promise<SyncPullResult> {
    const res = await fetch("/api/sync/prism-pull", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async getSyncRuns(): Promise<{ runs: SyncRun[] }> {
    const res = await fetch("/api/sync/prism-pull", { cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
};

export interface SyncPullResult {
  runId: string;
  status: "ok" | "partial";
  scanned: number;
  updated: number;
  removed: number;
  durationMs: number;
  txnsAdded: number;
  aggregatesUpdated: number;
  txnSyncDurationMs: number;
  txnSyncSkipped?: string;
  txnSyncError?: string | null;
}

export interface SyncRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
  scannedCount: number | null;
  updatedCount: number | null;
  removedCount: number | null;
  txnsAdded: number | null;
  aggregatesUpdated: number | null;
  txnSyncDurationMs: number | null;
  status: string;
  error: string | null;
}

export const savedSearchesApi = {
  async list(): Promise<{ items: Array<{ id: string; name: string; filter: Record<string, unknown>; isSystem: boolean }> }> {
    const res = await fetch("/api/saved-searches");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async create(body: { name: string; filter: Record<string, unknown> }) {
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
  async update(id: string, body: { name?: string; filter?: Record<string, unknown> }) {
    const res = await fetch(`/api/saved-searches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async remove(id: string) {
    const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
