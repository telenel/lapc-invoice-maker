/**
 * Prism -> Supabase pull sync. Reads Item + Inventory from Prism, hash-compares
 * against the products mirror, and upserts only changed rows. Idempotent.
 *
 * Pierce-scoped: INNER JOIN on Inventory.LocationID = 2 restricts the pull to
 * SKUs that Pierce actually stocks (~61k of the 195k district-wide Item master).
 * After the pull we delete any products rows whose SKU wasn't seen this run —
 * that's how items going out of Pierce stock (or pre-Pierce-scoping mirror
 * leftovers) get reaped.
 *
 * Classification: Prism's Item.TypeID is New(1)/Used(2), NOT textbook/GM.
 * Real type comes from whether a child row exists in Textbook or GeneralMerchandise.
 * Used items (TypeID=2) are labeled used_textbook — they're the "used copy"
 * sibling SKUs of real textbooks, but don't have their own Textbook row.
 */
import crypto from "crypto";
import { getPrismPool, sql } from "@/lib/prism";
import { PIERCE_LOCATION_ID } from "./prism-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface PrismItemRow {
  sku: number;
  description: string | null;
  barcode: string | null;
  vendorId: number | null;
  dccId: number | null;
  itemTaxTypeId: number | null;
  itemType: string;
  fDiscontinue: 0 | 1;
  retail: number | null;
  cost: number | null;
  lastSaleDate: Date | null;
}

function hashRow(r: PrismItemRow): string {
  const canonical = JSON.stringify([
    r.sku,
    r.description ?? "",
    r.barcode ?? "",
    r.vendorId ?? 0,
    r.dccId ?? 0,
    r.itemTaxTypeId ?? 0,
    r.itemType,
    r.fDiscontinue,
    r.retail ?? 0,
    r.cost ?? 0,
    r.lastSaleDate?.toISOString() ?? "",
  ]);
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export interface PullSyncResult {
  scanned: number;
  updated: number;
  removed: number;
  durationMs: number;
}

const DELETE_CHUNK_SIZE = 1000;

/**
 * Run one full-catalog pull. Paginates Prism reads with a SKU cursor to
 * avoid loading the ~61k Pierce-stocked rows into memory at once.
 */
export async function runPrismPull(options: {
  pageSize?: number;
  onProgress?: (scanned: number) => void;
} = {}): Promise<PullSyncResult> {
  const pageSize = options.pageSize ?? 2000;
  const started = Date.now();
  let scanned = 0;
  let updated = 0;

  const pool = await getPrismPool();
  const supabase = getSupabaseAdminClient();

  // Load existing SKU+hash map in one shot so we can hash-skip unchanged rows
  // and identify stale rows to delete at the end.
  const { data: existingRows, error: hashErr } = await supabase
    .from("products")
    .select("sku, sync_hash");
  if (hashErr) {
    throw new Error(`Supabase hash read failed: ${hashErr.message}`);
  }
  const existingHashes = new Map<number, string | null>();
  for (const r of existingRows ?? []) {
    existingHashes.set(r.sku, (r as { sync_hash: string | null }).sync_hash);
  }

  const seenSkus = new Set<number>();

  // Paginate Prism with SKU cursor (SKU is the PK, monotonically increasing)
  let lastSku = 0;
  while (true) {
    const result = await pool
      .request()
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .input("cursor", sql.Int, lastSku)
      .input("pageSize", sql.Int, pageSize)
      .query<{
        SKU: number;
        Description: string | null;
        BarCode: string | null;
        VendorID: number | null;
        DCCID: number | null;
        ItemTaxTypeID: number | null;
        ItemType: string;
        fDiscontinue: number | null;
        Retail: number | null;
        Cost: number | null;
        LastSaleDate: Date | null;
      }>(`
        SELECT TOP (@pageSize)
          i.SKU,
          LTRIM(RTRIM(gm.Description)) AS Description,
          LTRIM(RTRIM(i.BarCode))      AS BarCode,
          i.VendorID,
          i.DCCID,
          i.ItemTaxTypeID,
          CASE
            WHEN i.TypeID = 2                THEN 'used_textbook'
            WHEN tb.SKU IS NOT NULL          THEN 'textbook'
            WHEN gm.SKU IS NOT NULL          THEN 'general_merchandise'
            ELSE                                  'other'
          END AS ItemType,
          i.fDiscontinue,
          inv.Retail,
          inv.Cost,
          inv.LastSaleDate
        FROM Item i
        INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        LEFT JOIN Textbook tb ON tb.SKU = i.SKU
        LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
        WHERE i.SKU > @cursor
        ORDER BY i.SKU
      `);

    if (result.recordset.length === 0) break;

    const toUpsert: Array<Record<string, unknown>> = [];
    for (const raw of result.recordset) {
      scanned += 1;
      seenSkus.add(raw.SKU);
      const row: PrismItemRow = {
        sku: raw.SKU,
        description: raw.Description,
        barcode: raw.BarCode && raw.BarCode.length > 0 ? raw.BarCode : null,
        vendorId: raw.VendorID,
        dccId: raw.DCCID,
        itemTaxTypeId: raw.ItemTaxTypeID,
        itemType: raw.ItemType,
        fDiscontinue: raw.fDiscontinue === 1 ? 1 : 0,
        retail: raw.Retail != null ? Number(raw.Retail) : null,
        cost: raw.Cost != null ? Number(raw.Cost) : null,
        lastSaleDate: raw.LastSaleDate ?? null,
      };
      const newHash = hashRow(row);
      if (existingHashes.get(row.sku) === newHash) continue;

      toUpsert.push({
        sku: row.sku,
        description: row.description,
        barcode: row.barcode,
        vendor_id: row.vendorId,
        dcc_id: row.dccId,
        item_tax_type_id: row.itemTaxTypeId,
        item_type: row.itemType,
        discontinued: row.fDiscontinue === 1,
        retail_price: row.retail,
        cost: row.cost,
        last_sale_date: row.lastSaleDate?.toISOString() ?? null,
        sync_hash: newHash,
        synced_at: new Date().toISOString(),
      });
    }

    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from("products").upsert(toUpsert);
      if (upsertErr) {
        throw new Error(`Supabase upsert failed: ${upsertErr.message}`);
      }
      updated += toUpsert.length;
    }

    lastSku = result.recordset[result.recordset.length - 1].SKU;
    options.onProgress?.(scanned);

    if (result.recordset.length < pageSize) break;
  }

  // Reap rows whose SKU wasn't in Pierce stock this run. Includes both
  // legitimately discontinued items and — on the first post-fix sync —
  // the ~134k district-wide leftovers that the old LEFT-JOIN sync pulled.
  const staleSkus: number[] = [];
  existingHashes.forEach((_, sku) => {
    if (!seenSkus.has(sku)) staleSkus.push(sku);
  });

  let removed = 0;
  for (let i = 0; i < staleSkus.length; i += DELETE_CHUNK_SIZE) {
    const chunk = staleSkus.slice(i, i + DELETE_CHUNK_SIZE);
    const { error: delErr } = await supabase.from("products").delete().in("sku", chunk);
    if (delErr) {
      throw new Error(`Supabase stale-delete failed: ${delErr.message}`);
    }
    removed += chunk.length;
  }

  return {
    scanned,
    updated,
    removed,
    durationMs: Date.now() - started,
  };
}
