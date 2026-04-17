/**
 * Prism -> Supabase pull sync. Reads Item + Inventory from Prism, hash-compares
 * against the products mirror, and upserts only changed rows. Idempotent.
 *
 * Pierce-only: Inventory is joined on LocationID = 2 (Pierce). Item-master
 * fields (description, DCC, tax, barcode) are district-wide.
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
  durationMs: number;
}

/**
 * Run one full-catalog pull. Paginates Prism reads with a SKU cursor to
 * avoid loading the ~195k-row catalog into memory at once.
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

  // Load existing hashes from Supabase in one shot (~195k rows, ~20MB -- acceptable)
  const { data: existingHashRows, error: hashErr } = await supabase
    .from("products")
    .select("sku, sync_hash");
  if (hashErr) {
    throw new Error(`Supabase hash read failed: ${hashErr.message}`);
  }
  const existingHashes = new Map<number, string | null>();
  for (const r of existingHashRows ?? []) {
    existingHashes.set(r.sku, (r as { sync_hash: string | null }).sync_hash);
  }

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
          CASE WHEN i.TypeID = 1 THEN 'textbook' ELSE 'general_merchandise' END AS ItemType,
          i.fDiscontinue,
          inv.Retail,
          inv.Cost,
          inv.LastSaleDate
        FROM Item i
        LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
        LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        WHERE i.SKU > @cursor
        ORDER BY i.SKU
      `);

    if (result.recordset.length === 0) break;

    const toUpsert: Array<Record<string, unknown>> = [];
    for (const raw of result.recordset) {
      scanned += 1;
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
      lastSku = row.sku;
    }

    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from("products").upsert(toUpsert);
      if (upsertErr) {
        throw new Error(`Supabase upsert failed: ${upsertErr.message}`);
      }
      updated += toUpsert.length;
    }

    // Advance cursor even if no rows needed upsert
    if (toUpsert.length === 0) {
      lastSku = result.recordset[result.recordset.length - 1].SKU;
    }
    options.onProgress?.(scanned);

    if (result.recordset.length < pageSize) break;
  }

  return {
    scanned,
    updated,
    durationMs: Date.now() - started,
  };
}
