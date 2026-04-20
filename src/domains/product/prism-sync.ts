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
 *
 * Textbook metadata (title/author/isbn/edition) comes from the Textbook table,
 * GM descriptions from GeneralMerchandise. Stock level comes from Inventory.
 */
import crypto from "crypto";
import { getPrismPool, sql } from "@/lib/prism";
import { PIERCE_LOCATION_ID } from "./prism-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Global (per-SKU) fields — written to the products table.
export interface PrismItemRow {
  sku: number;
  // Textbook metadata (nullable for non-textbook items)
  description: string | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  edition: string | null;
  binding_id: number | null;
  binding_label: string | null;
  imprint: string | null;
  copyright: string | null;
  usedSku: number | null;
  textStatusId: number | null;
  statusDate: Date | null;
  typeTextbook: string | null;
  bookKey: string | null;
  // Item table (global)
  barcode: string | null;
  vendorId: number | null;
  altVendorId: number | null;
  mfgId: number | null;
  dccId: number | null;
  usedDccId: number | null;
  itemTaxTypeId: number | null;
  itemTaxTypeLabel: string | null;
  itemType: string;
  fDiscontinue: 0 | 1;
  txComment: string | null;
  weight: number | null;
  styleId: number | null;
  itemSeasonCodeId: number | null;
  fListPriceFlag: 0 | 1;
  fPerishable: 0 | 1;
  fIdRequired: 0 | 1;
  minOrderQtyItem: number | null;
  // GM (global, present when item_type = general_merchandise)
  typeGm: string | null;
  size: string | null;
  sizeId: number | null;
  catalogNumber: string | null;
  packageType: string | null;
  packageTypeLabel: string | null;
  unitsPerPack: number | null;
  orderIncrement: number;
  imageUrl: string | null;
  useScaleInterface: 0 | 1;
  tare: number | null;
  // DCC labels (pre-existing)
  deptNum: number | null;
  classNum: number | null;
  catNum: number | null;
  deptName: string | null;
  className: string | null;
  catName: string | null;
}

// Per-location fields — one row per (SKU, LocationID) in {2, 3, 4}.
export interface PrismInventoryRow {
  sku: number;
  locationId: 2 | 3 | 4;
  locationAbbrev: string;
  retail: number | null;
  cost: number | null;
  expectedCost: number | null;
  stockOnHand: number | null;
  tagTypeId: number | null;
  tagTypeLabel: string | null;
  statusCodeId: number | null;
  statusCodeLabel: string | null;
  taxTypeOverrideId: number | null;
  discCodeId: number | null;
  minStock: number | null;
  maxStock: number | null;
  autoOrderQty: number | null;
  minOrderQty: number | null;
  holdQty: number | null;
  reservedQty: number | null;
  rentalQty: number | null;
  estSales: number | null;
  estSalesLocked: 0 | 1;
  royaltyCost: number | null;
  minRoyaltyCost: number | null;
  fInvListPriceFlag: 0 | 1;
  fTxWantListFlag: 0 | 1;
  fTxBuybackListFlag: 0 | 1;
  fRentOnly: 0 | 1;
  fNoReturns: 0 | 1;
  textCommentInv: string | null;
  lastSaleDate: Date | null;
  lastInventoryDate: Date | null;
  createDate: Date | null;
}

function hashRow(r: PrismItemRow): string {
  const canonical = JSON.stringify([
    r.sku,
    r.description ?? "",
    r.title ?? "",
    r.author ?? "",
    r.isbn ?? "",
    r.edition ?? "",
    r.barcode ?? "",
    r.vendorId ?? 0,
    r.dccId ?? 0,
    r.itemTaxTypeId ?? 0,
    r.itemType,
    r.fDiscontinue,
    r.retail ?? 0,
    r.cost ?? 0,
    r.stockOnHand ?? 0,
    r.deptNum ?? 0,
    r.classNum ?? 0,
    r.catNum ?? 0,
    r.deptName ?? "",
    r.className ?? "",
    r.catName ?? "",
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
const HASH_READ_PAGE_SIZE = 1000;

export function buildPrismPullPageQuery(): string {
  return `
        SELECT TOP (@pageSize)
          i.SKU,
          LTRIM(RTRIM(gm.Description)) AS Description,
          LTRIM(RTRIM(tb.Title))       AS Title,
          LTRIM(RTRIM(tb.Author))      AS Author,
          LTRIM(RTRIM(tb.ISBN))        AS ISBN,
          LTRIM(RTRIM(tb.Edition))     AS Edition,
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
          dcc.Department                  AS DeptNum,
          dcc.Class                       AS ClassNum,
          dcc.Category                    AS CatNum,
          LTRIM(RTRIM(dep.DeptName))      AS DeptName,
          LTRIM(RTRIM(cls.ClassName))     AS ClassName,
          LTRIM(RTRIM(cat.CatName))       AS CatName,
          i.fDiscontinue,
          inv.Retail,
          inv.Cost,
          inv.StockOnHand,
          inv.LastSaleDate
        FROM Item i
        INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        LEFT JOIN Textbook tb ON tb.SKU = i.SKU
        LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
        LEFT JOIN DeptClassCat dcc ON i.DCCID = dcc.DCCID
        LEFT JOIN DCC_Department dep ON dcc.Department = dep.Department
        LEFT JOIN DCC_Class      cls ON dcc.Department = cls.Department
                                     AND dcc.Class      = cls.Class
        LEFT JOIN DCC_Category   cat ON dcc.Department = cat.Department
                                     AND dcc.Class      = cat.Class
                                     AND dcc.Category   = cat.Category
        WHERE i.SKU > @cursor
        ORDER BY i.SKU
      `;
}

// Prism stores "never sold" as epoch zero (1970-01-01 00:00:00) instead of NULL
// on Inventory.LastSaleDate. Treat anything at or before the epoch as null so
// the UI doesn't render "Dec 1969" due to Pacific-TZ underflow of UTC epoch.
function coerceEpochZeroDate(d: Date | null | undefined): Date | null {
  if (!d) return null;
  return d.getTime() > 0 ? d : null;
}

// Supabase PostgREST caps anonymous `.select()` results at a configured max
// (default 1000). Without pagination the mirror-hash map was truncated and
// the reap step quietly left ~134k stale rows behind on 2026-04-17. Always
// paginate this read with `.range()`.
async function loadExistingHashes(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>();
  let from = 0;
  while (true) {
    const to = from + HASH_READ_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("products")
      .select("sku, sync_hash")
      .order("sku", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Supabase hash read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      map.set((r as { sku: number }).sku, (r as { sync_hash: string | null }).sync_hash);
    }
    if (data.length < HASH_READ_PAGE_SIZE) break;
    from += HASH_READ_PAGE_SIZE;
  }
  return map;
}

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

  const existingHashes = await loadExistingHashes(supabase);
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
        Title: string | null;
        Author: string | null;
        ISBN: string | null;
        Edition: string | null;
        BarCode: string | null;
        VendorID: number | null;
        DCCID: number | null;
        ItemTaxTypeID: number | null;
        ItemType: string;
        fDiscontinue: number | null;
        Retail: number | null;
        Cost: number | null;
        StockOnHand: number | null;
        LastSaleDate: Date | null;
        DeptNum: number | null;
        ClassNum: number | null;
        CatNum: number | null;
        DeptName: string | null;
        ClassName: string | null;
        CatName: string | null;
      }>(buildPrismPullPageQuery());

    if (result.recordset.length === 0) break;

    const toUpsert: Array<Record<string, unknown>> = [];
    for (const raw of result.recordset) {
      scanned += 1;
      seenSkus.add(raw.SKU);
      const row: PrismItemRow = {
        sku: raw.SKU,
        description: raw.Description && raw.Description.length > 0 ? raw.Description : null,
        title: raw.Title && raw.Title.length > 0 ? raw.Title : null,
        author: raw.Author && raw.Author.length > 0 ? raw.Author : null,
        isbn: raw.ISBN && raw.ISBN.length > 0 ? raw.ISBN : null,
        edition: raw.Edition && raw.Edition.length > 0 ? raw.Edition : null,
        barcode: raw.BarCode && raw.BarCode.length > 0 ? raw.BarCode : null,
        vendorId: raw.VendorID,
        dccId: raw.DCCID,
        itemTaxTypeId: raw.ItemTaxTypeID,
        itemType: raw.ItemType,
        fDiscontinue: raw.fDiscontinue === 1 ? 1 : 0,
        retail: raw.Retail != null ? Number(raw.Retail) : null,
        cost: raw.Cost != null ? Number(raw.Cost) : null,
        stockOnHand: raw.StockOnHand != null ? Number(raw.StockOnHand) : null,
        lastSaleDate: coerceEpochZeroDate(raw.LastSaleDate ?? null),
        deptNum: raw.DeptNum,
        classNum: raw.ClassNum,
        catNum: raw.CatNum,
        deptName: raw.DeptName && raw.DeptName.length > 0 ? raw.DeptName : null,
        className: raw.ClassName && raw.ClassName.length > 0 ? raw.ClassName : null,
        catName: raw.CatName && raw.CatName.length > 0 ? raw.CatName : null,
      };
      const newHash = hashRow(row);
      if (existingHashes.get(row.sku) === newHash) continue;

      toUpsert.push({
        sku: row.sku,
        description: row.description,
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        edition: row.edition,
        barcode: row.barcode,
        vendor_id: row.vendorId,
        dcc_id: row.dccId,
        item_tax_type_id: row.itemTaxTypeId,
        item_type: row.itemType,
        discontinued: row.fDiscontinue === 1,
        retail_price: row.retail,
        cost: row.cost,
        stock_on_hand: row.stockOnHand,
        last_sale_date: row.lastSaleDate?.toISOString() ?? null,
        dept_num: row.deptNum,
        class_num: row.classNum,
        cat_num: row.catNum,
        dept_name: row.deptName,
        class_name: row.className,
        cat_name: row.catName,
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
