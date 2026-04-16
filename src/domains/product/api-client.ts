/**
 * Client-side API wrappers for the product write endpoints.
 *
 * These hit the Next.js routes under /api/products which talk to Prism on the
 * backend. They are designed to fail soft when Prism is unreachable (the
 * health endpoint reports `available: false`).
 */

export interface PrismHealth {
  available: boolean;
  configured: boolean;
  reason: string | null;
}

export interface PrismVendorRef { vendorId: number; name: string }
export interface PrismDccRef { dccId: number; deptName: string; className: string | null }
export interface PrismTaxTypeRef { taxTypeId: number; description: string }

export interface PrismRefs {
  vendors: PrismVendorRef[];
  dccs: PrismDccRef[];
  taxTypes: PrismTaxTypeRef[];
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

  async hardDelete(sku: number): Promise<{ sku: number; mode: string; affected: number }> {
    const res = await fetch(`/api/products/${sku}?hard=true`, { method: "DELETE" });
    if (!res.ok) throw new Error(await parseError(res));
    return (await res.json()) as { sku: number; mode: string; affected: number };
  },
};
