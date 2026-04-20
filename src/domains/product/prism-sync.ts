/**
 * Prism -> Supabase pull sync. Reads Item + Inventory from Prism and upserts
 * into both the products (global, per-SKU) and product_inventory (per-location)
 * tables. Idempotent.
 *
 * Multi-location: INNER JOIN on Inventory.LocationID IN (2, 3, 4) covers
 * PIER, PCOP, and PFS. Each (SKU, LocationID) pair lands in product_inventory.
 * The PIER slice of retail/cost/stock is denormalized into products for UI
 * backwards-compat until the UI reads from product_inventory directly.
 *
 * Classification: Prism's Item.TypeID is New(1)/Used(2), NOT textbook/GM.
 * Real type comes from whether a child row exists in Textbook or GeneralMerchandise.
 * Used items (TypeID=2) are labeled used_textbook — they're the "used copy"
 * sibling SKUs of real textbooks, but don't have their own Textbook row.
 *
 * Textbook metadata (title/author/isbn/edition) comes from the Textbook table,
 * GM descriptions from GeneralMerchandise. Stock level comes from Inventory.
 *
 * Reap (deleting stale SKUs/inventory rows) is handled in P1.9. For now, the
 * sync is additive-only — safe but does not prune rows that leave Pierce stock.
 */
import { getPrismPool, sql } from "@/lib/prism";
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


export interface PullSyncResult {
  scanned: number;
  updated: number;
  removed: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Raw shape returned by buildPrismPullPageQuery. Matches the SELECT list.
// Labels are still whitespace-padded as returned from Prism's CHAR columns
// — we trim in shredRecordset.
// ---------------------------------------------------------------------------
interface PrismPullRecord {
  SKU: number;
  LocationID: number;
  LocationAbbrev: string;
  Description: string | null;
  TypeGm: string | null;
  Size: string | null;
  SizeID: number | null;
  GmColor: number;
  CatalogNumber: string | null;
  PackageType: string | null;
  PackageTypeLabel: string | null;
  UnitsPerPack: number | null;
  GmWeight: number | null;
  ImageURL: string | null;
  OrderIncrement: number;
  UseScaleInterface: 0 | 1;
  Tare: number | null;
  MfgID: number;
  AltVendorID: number;
  Title: string | null;
  Author: string | null;
  ISBN: string | null;
  Edition: string | null;
  BindingID: number | null;
  Imprint: string | null;
  Copyright: string | null;
  UsedSKU: number | null;
  TextStatusID: number | null;
  StatusDate: Date | null;
  TypeTextbook: string | null;
  BookKey: string | null;
  BindingLabel: string | null;
  BarCode: string | null;
  VendorID: number | null;
  DCCID: number | null;
  UsedDCCID: number | null;
  ItemTaxTypeID: number | null;
  ItemTaxTypeLabel: string | null;
  TxComment: string | null;
  ItemWeight: number | null;
  StyleID: number | null;
  ItemSeasonCodeID: number | null;
  fListPriceFlag: 0 | 1;
  fPerishable: 0 | 1;
  fIDRequired: 0 | 1;
  MinOrderQtyItem: number | null;
  ItemType: string;
  fDiscontinue: 0 | 1;
  DeptNum: number | null;
  ClassNum: number | null;
  CatNum: number | null;
  DeptName: string | null;
  ClassName: string | null;
  CatName: string | null;
  Retail: number | null;
  Cost: number | null;
  ExpectedCost: number | null;
  StockOnHand: number | null;
  TagTypeID: number | null;
  TagTypeLabel: string | null;
  StatusCodeID: number | null;
  StatusCodeLabel: string | null;
  TaxTypeOverrideID: number | null;
  InvDiscCodeID: number | null;
  InvMinStock: number | null;
  InvMaxStock: number | null;
  InvAutoOrderQty: number | null;
  InvMinOrderQty: number | null;
  ReservedQty: number | null;
  RentalQty: number | null;
  EstSales: number;
  EstSalesLocked: 0 | 1;
  RoyaltyCost: number | null;
  MinRoyaltyCost: number | null;
  fInvListPriceFlag: 0 | 1;
  fTXWantListFlag: 0 | 1;
  fTXBuybackListFlag: 0 | 1;
  fRentOnly: 0 | 1;
  fNoReturns: 0 | 1;
  TextCommentInv: string | null;
  LastSaleDate: Date | null;
  LastInventoryDate: Date | null;
  InvCreateDate: Date | null;
}

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

/**
 * Split a Prism recordset (one row per (sku, location_id)) into:
 *   - items: one PrismItemRow per distinct SKU (first occurrence wins).
 *   - inventory: one PrismInventoryRow per input row.
 *
 * Throws if any row carries LocationID 5 (PBO) — the query already filters
 * to IN (2, 3, 4), so this is a belt-and-suspenders defense.
 */
export function shredRecordset(
  recordset: PrismPullRecord[],
): { items: PrismItemRow[]; inventory: PrismInventoryRow[] } {
  const itemsBySku = new Map<number, PrismItemRow>();
  const inventory: PrismInventoryRow[] = [];

  for (const raw of recordset) {
    if (raw.LocationID === 5) {
      throw new Error(
        `LocationID 5 (PBO) encountered in Prism recordset — excluded by hard rule`,
      );
    }
    if (raw.LocationID !== 2 && raw.LocationID !== 3 && raw.LocationID !== 4) {
      throw new Error(
        `Unexpected LocationID ${raw.LocationID} in Pierce pull — expected 2, 3, or 4`,
      );
    }

    if (!itemsBySku.has(raw.SKU)) {
      itemsBySku.set(raw.SKU, {
        sku: raw.SKU,
        description: trimOrNull(raw.Description),
        title: trimOrNull(raw.Title),
        author: trimOrNull(raw.Author),
        isbn: trimOrNull(raw.ISBN),
        edition: trimOrNull(raw.Edition),
        binding_id: raw.BindingID,
        binding_label: trimOrNull(raw.BindingLabel),
        imprint: trimOrNull(raw.Imprint),
        copyright: trimOrNull(raw.Copyright),
        usedSku: raw.UsedSKU,
        textStatusId: raw.TextStatusID,
        statusDate: raw.StatusDate,
        typeTextbook: trimOrNull(raw.TypeTextbook),
        bookKey: trimOrNull(raw.BookKey),
        barcode: trimOrNull(raw.BarCode),
        vendorId: raw.VendorID,
        altVendorId: raw.AltVendorID && raw.AltVendorID > 0 ? raw.AltVendorID : null,
        mfgId: raw.MfgID && raw.MfgID > 0 ? raw.MfgID : null,
        dccId: raw.DCCID,
        usedDccId: raw.UsedDCCID,
        itemTaxTypeId: raw.ItemTaxTypeID,
        itemTaxTypeLabel: trimOrNull(raw.ItemTaxTypeLabel),
        itemType: raw.ItemType,
        fDiscontinue: raw.fDiscontinue === 1 ? 1 : 0,
        txComment: trimOrNull(raw.TxComment),
        weight: raw.ItemWeight != null ? Number(raw.ItemWeight) : null,
        styleId: raw.StyleID,
        itemSeasonCodeId: raw.ItemSeasonCodeID,
        fListPriceFlag: raw.fListPriceFlag === 1 ? 1 : 0,
        fPerishable: raw.fPerishable === 1 ? 1 : 0,
        fIdRequired: raw.fIDRequired === 1 ? 1 : 0,
        minOrderQtyItem: raw.MinOrderQtyItem,
        typeGm: trimOrNull(raw.TypeGm),
        size: trimOrNull(raw.Size),
        sizeId: raw.SizeID,
        catalogNumber: trimOrNull(raw.CatalogNumber),
        packageType: trimOrNull(raw.PackageType),
        packageTypeLabel: trimOrNull(raw.PackageTypeLabel),
        unitsPerPack: raw.UnitsPerPack,
        orderIncrement: raw.OrderIncrement ?? 1,
        imageUrl: trimOrNull(raw.ImageURL),
        useScaleInterface: raw.UseScaleInterface === 1 ? 1 : 0,
        tare: raw.Tare != null ? Number(raw.Tare) : null,
        deptNum: raw.DeptNum,
        classNum: raw.ClassNum,
        catNum: raw.CatNum,
        deptName: trimOrNull(raw.DeptName),
        className: trimOrNull(raw.ClassName),
        catName: trimOrNull(raw.CatName),
      });
    }

    inventory.push({
      sku: raw.SKU,
      locationId: raw.LocationID as 2 | 3 | 4,
      locationAbbrev: trimOrNull(raw.LocationAbbrev) ?? "",
      retail: raw.Retail != null ? Number(raw.Retail) : null,
      cost: raw.Cost != null ? Number(raw.Cost) : null,
      expectedCost: raw.ExpectedCost != null ? Number(raw.ExpectedCost) : null,
      stockOnHand: raw.StockOnHand != null ? Number(raw.StockOnHand) : null,
      tagTypeId: raw.TagTypeID,
      tagTypeLabel: trimOrNull(raw.TagTypeLabel),
      statusCodeId: raw.StatusCodeID,
      statusCodeLabel: trimOrNull(raw.StatusCodeLabel),
      taxTypeOverrideId: raw.TaxTypeOverrideID,
      discCodeId: raw.InvDiscCodeID,
      minStock: raw.InvMinStock,
      maxStock: raw.InvMaxStock,
      autoOrderQty: raw.InvAutoOrderQty,
      minOrderQty: raw.InvMinOrderQty,
      holdQty: null,
      reservedQty: raw.ReservedQty,
      rentalQty: raw.RentalQty,
      estSales: raw.EstSales,
      estSalesLocked: raw.EstSalesLocked === 1 ? 1 : 0,
      royaltyCost: raw.RoyaltyCost != null ? Number(raw.RoyaltyCost) : null,
      minRoyaltyCost: raw.MinRoyaltyCost != null ? Number(raw.MinRoyaltyCost) : null,
      fInvListPriceFlag: raw.fInvListPriceFlag === 1 ? 1 : 0,
      fTxWantListFlag: raw.fTXWantListFlag === 1 ? 1 : 0,
      fTxBuybackListFlag: raw.fTXBuybackListFlag === 1 ? 1 : 0,
      fRentOnly: raw.fRentOnly === 1 ? 1 : 0,
      fNoReturns: raw.fNoReturns === 1 ? 1 : 0,
      textCommentInv: trimOrNull(raw.TextCommentInv),
      lastSaleDate: coerceEpochZeroDate(raw.LastSaleDate),
      lastInventoryDate: raw.LastInventoryDate,
      createDate: raw.InvCreateDate,
    });
  }

  return { items: Array.from(itemsBySku.values()), inventory };
}

/**
 * Build the upsert payload for the products table (global fields + the
 * PIER-compat pricing triad). If pierInventory is null, the compat
 * columns are written NULL.
 */
export function buildProductsUpsertPayload(
  item: PrismItemRow,
  pierInventory: PrismInventoryRow | null,
): Record<string, unknown> {
  return {
    sku: item.sku,
    item_type: item.itemType,
    description: item.description,
    title: item.title,
    author: item.author,
    isbn: item.isbn,
    edition: item.edition,
    binding_id: item.binding_id,
    binding_label: item.binding_label,
    imprint: item.imprint,
    copyright: item.copyright,
    used_sku: item.usedSku,
    text_status_id: item.textStatusId,
    status_date: item.statusDate,
    type_textbook: item.typeTextbook,
    book_key: item.bookKey,
    barcode: item.barcode,
    vendor_id: item.vendorId,
    alt_vendor_id: item.altVendorId,
    mfg_id: item.mfgId,
    dcc_id: item.dccId,
    used_dcc_id: item.usedDccId,
    item_tax_type_id: item.itemTaxTypeId,
    item_tax_type_label: item.itemTaxTypeLabel,
    tx_comment: item.txComment,
    weight: item.weight,
    style_id: item.styleId,
    item_season_code_id: item.itemSeasonCodeId,
    f_list_price_flag: !!item.fListPriceFlag,
    f_perishable: !!item.fPerishable,
    f_id_required: !!item.fIdRequired,
    min_order_qty_item: item.minOrderQtyItem,
    type_gm: item.typeGm,
    size: item.size,
    size_id: item.sizeId,
    catalog_number: item.catalogNumber,
    package_type: item.packageType,
    package_type_label: item.packageTypeLabel,
    units_per_pack: item.unitsPerPack,
    order_increment: item.orderIncrement,
    image_url: item.imageUrl,
    use_scale_interface: !!item.useScaleInterface,
    tare: item.tare,
    dept_num: item.deptNum,
    class_num: item.classNum,
    cat_num: item.catNum,
    dept_name: item.deptName,
    class_name: item.className,
    cat_name: item.catName,
    discontinued: item.fDiscontinue === 1,
    retail_price: pierInventory?.retail ?? null,
    cost: pierInventory?.cost ?? null,
    stock_on_hand: pierInventory?.stockOnHand ?? null,
    last_sale_date: pierInventory?.lastSaleDate ?? null,
    synced_at: new Date().toISOString(),
  };
}

export function buildProductInventoryUpsertPayload(
  inv: PrismInventoryRow,
): Record<string, unknown> {
  return {
    sku: inv.sku,
    location_id: inv.locationId,
    location_abbrev: inv.locationAbbrev,
    retail_price: inv.retail,
    cost: inv.cost,
    expected_cost: inv.expectedCost,
    stock_on_hand: inv.stockOnHand,
    tag_type_id: inv.tagTypeId,
    tag_type_label: inv.tagTypeLabel,
    status_code_id: inv.statusCodeId,
    status_code_label: inv.statusCodeLabel,
    tax_type_override_id: inv.taxTypeOverrideId,
    disc_code_id: inv.discCodeId,
    min_stock: inv.minStock,
    max_stock: inv.maxStock,
    auto_order_qty: inv.autoOrderQty,
    min_order_qty: inv.minOrderQty,
    hold_qty: inv.holdQty,
    reserved_qty: inv.reservedQty,
    rental_qty: inv.rentalQty,
    est_sales: inv.estSales,
    est_sales_locked: !!inv.estSalesLocked,
    royalty_cost: inv.royaltyCost,
    min_royalty_cost: inv.minRoyaltyCost,
    f_inv_list_price_flag: !!inv.fInvListPriceFlag,
    f_tx_want_list_flag: !!inv.fTxWantListFlag,
    f_tx_buyback_list_flag: !!inv.fTxBuybackListFlag,
    f_rent_only: !!inv.fRentOnly,
    f_no_returns: !!inv.fNoReturns,
    text_comment_inv: inv.textCommentInv,
    last_sale_date: inv.lastSaleDate,
    last_inventory_date: inv.lastInventoryDate,
    create_date: inv.createDate,
    synced_at: new Date().toISOString(),
  };
}

export function buildPrismPullPageQuery(): string {
  return `
        SELECT TOP (@pageSize)
          i.SKU,
          inv.LocationID,
          LTRIM(RTRIM(loc.Abbreviation))    AS LocationAbbrev,

          -- GM (NULL for textbook rows)
          LTRIM(RTRIM(gm.Description))      AS Description,
          LTRIM(RTRIM(gm.Type))             AS TypeGm,
          LTRIM(RTRIM(gm.Size))             AS Size,
          gm.SizeID,
          gm.Color                          AS GmColor,
          LTRIM(RTRIM(gm.CatalogNumber))    AS CatalogNumber,
          LTRIM(RTRIM(gm.PackageType))      AS PackageType,
          LTRIM(RTRIM(pkg.Description))     AS PackageTypeLabel,
          gm.UnitsPerPack,
          gm.Weight                         AS GmWeight,
          LTRIM(RTRIM(gm.ImageURL))         AS ImageURL,
          gm.OrderIncrement,
          gm.UseScaleInterface,
          gm.Tare,
          gm.MfgID,
          gm.AlternateVendorID              AS AltVendorID,

          -- Textbook (NULL for GM rows)
          LTRIM(RTRIM(tb.Title))            AS Title,
          LTRIM(RTRIM(tb.Author))           AS Author,
          LTRIM(RTRIM(tb.ISBN))             AS ISBN,
          LTRIM(RTRIM(tb.Edition))          AS Edition,
          tb.BindingID,
          LTRIM(RTRIM(bnd.Name))            AS BindingLabel,
          LTRIM(RTRIM(tb.Imprint))          AS Imprint,
          LTRIM(RTRIM(tb.Copyright))        AS Copyright,
          tb.UsedSKU,
          tb.TextStatusID,
          tb.StatusDate,
          LTRIM(RTRIM(tb.Type))             AS TypeTextbook,
          LTRIM(RTRIM(tb.Bookkey))          AS BookKey,

          -- Item (global)
          LTRIM(RTRIM(i.BarCode))           AS BarCode,
          i.VendorID,
          i.DCCID,
          i.UsedDCCID,
          i.ItemTaxTypeID,
          LTRIM(RTRIM(itt.Description))     AS ItemTaxTypeLabel,
          LTRIM(RTRIM(i.txComment))         AS TxComment,
          i.Weight                          AS ItemWeight,
          i.StyleID,
          i.ItemSeasonCodeID,
          i.fListPriceFlag,
          i.fPerishable,
          i.fIDRequired,
          i.MinOrderQty                     AS MinOrderQtyItem,
          CASE
            WHEN i.TypeID = 2                THEN 'used_textbook'
            WHEN tb.SKU IS NOT NULL          THEN 'textbook'
            WHEN gm.SKU IS NOT NULL          THEN 'general_merchandise'
            ELSE                                  'other'
          END AS ItemType,
          i.fDiscontinue,

          -- DCC labels
          dcc.Department                    AS DeptNum,
          dcc.Class                         AS ClassNum,
          dcc.Category                      AS CatNum,
          LTRIM(RTRIM(dep.DeptName))        AS DeptName,
          LTRIM(RTRIM(cls.ClassName))       AS ClassName,
          LTRIM(RTRIM(cat.CatName))         AS CatName,

          -- Inventory (per-location)
          inv.Retail,
          inv.Cost,
          inv.ExpectedCost,
          inv.StockOnHand,
          inv.TagTypeID,
          LTRIM(RTRIM(tag.Description))     AS TagTypeLabel,
          inv.StatusCodeID,
          LTRIM(RTRIM(sc.StatusCodeName))   AS StatusCodeLabel,
          inv.TaxTypeID                     AS TaxTypeOverrideID,
          inv.DiscCodeID                    AS InvDiscCodeID,
          inv.MinimumStock                  AS InvMinStock,
          inv.MaximumStock                  AS InvMaxStock,
          inv.AutoOrderQty                  AS InvAutoOrderQty,
          inv.MinOrderQty                   AS InvMinOrderQty,
          inv.ReservedQty,
          inv.RentalQty,
          inv.EstSales,
          inv.EstSalesLocked,
          inv.RoyaltyCost,
          inv.MinRoyaltyCost,
          inv.fInvListPriceFlag,
          inv.fTXWantListFlag,
          inv.fTXBuybackListFlag,
          inv.fRentOnly,
          inv.fNoReturns,
          inv.TextComment                   AS TextCommentInv,
          inv.LastSaleDate,
          inv.LastInventoryDate,
          inv.CreateDate                    AS InvCreateDate
        FROM Item i
        INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN (2, 3, 4)
        INNER JOIN Location loc ON loc.LocationID = inv.LocationID
        LEFT JOIN Textbook tb ON tb.SKU = i.SKU
        LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
        LEFT JOIN DeptClassCat dcc ON i.DCCID = dcc.DCCID
        LEFT JOIN DCC_Department dep ON dcc.Department = dep.Department
        LEFT JOIN DCC_Class      cls ON dcc.Department = cls.Department
                                     AND dcc.Class      = cls.Class
        LEFT JOIN DCC_Category   cat ON dcc.Department = cat.Department
                                     AND dcc.Class      = cat.Class
                                     AND dcc.Category   = cat.Category
        LEFT JOIN Item_Tax_Type itt ON itt.ItemTaxTypeID = i.ItemTaxTypeID
        LEFT JOIN TagType tag ON tag.TagTypeID = inv.TagTypeID
        LEFT JOIN PackageType pkg ON pkg.PackageType = gm.PackageType
        LEFT JOIN InventoryStatusCodes sc ON sc.InvStatusCodeID = inv.StatusCodeID
        LEFT JOIN Binding bnd ON bnd.BindingID = tb.BindingID
        WHERE i.SKU > @cursor OR (i.SKU = @cursor AND inv.LocationID > @lastLoc)
        ORDER BY i.SKU, inv.LocationID
      `;
}

// Prism stores "never sold" as epoch zero (1970-01-01 00:00:00) instead of NULL
// on Inventory.LastSaleDate. Treat anything at or before the epoch as null so
// the UI doesn't render "Dec 1969" due to Pacific-TZ underflow of UTC epoch.
function coerceEpochZeroDate(d: Date | null | undefined): Date | null {
  if (!d) return null;
  return d.getTime() > 0 ? d : null;
}

/**
 * Given the set of (sku:location) keys that existed in product_inventory
 * before this run and the set observed during this run, return:
 *   - inventoryToDelete: (sku:location) keys to DELETE from product_inventory
 *   - skusWithNoLocations: SKUs that are now orphaned (zero remaining Pierce
 *     inventory rows); products rows should also be reaped.
 */
export function computeReapSet(
  existing: Set<string>,
  seen: Set<string>,
): { inventoryToDelete: Set<string>; skusWithNoLocations: Set<number> } {
  const inventoryToDelete = new Set<string>();
  for (const key of existing) {
    if (!seen.has(key)) inventoryToDelete.add(key);
  }

  const remainingBySku = new Map<number, number>();
  for (const key of existing) {
    if (!inventoryToDelete.has(key)) {
      const sku = Number(key.split(":")[0]);
      remainingBySku.set(sku, (remainingBySku.get(sku) ?? 0) + 1);
    }
  }

  const skusWithNoLocations = new Set<number>();
  const skusInExisting = new Set<number>();
  for (const key of existing) {
    skusInExisting.add(Number(key.split(":")[0]));
  }
  for (const sku of skusInExisting) {
    if ((remainingBySku.get(sku) ?? 0) === 0) {
      skusWithNoLocations.add(sku);
    }
  }

  return { inventoryToDelete, skusWithNoLocations };
}

const DELETE_CHUNK_SIZE = 1000;
const INVENTORY_KEY_READ_PAGE_SIZE = 1000;

async function loadExistingInventoryKeys(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
): Promise<Set<string>> {
  const keys = new Set<string>();
  let from = 0;
  while (true) {
    const to = from + INVENTORY_KEY_READ_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("product_inventory")
      .select("sku, location_id")
      .order("sku", { ascending: true })
      .order("location_id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Supabase product_inventory read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      keys.add(`${(r as { sku: number }).sku}:${(r as { location_id: number }).location_id}`);
    }
    if (data.length < INVENTORY_KEY_READ_PAGE_SIZE) break;
    from += INVENTORY_KEY_READ_PAGE_SIZE;
  }
  return keys;
}

/**
 * Run one full-catalog pull. Paginates Prism reads with a (sku, locationId)
 * cursor to avoid loading the ~180k Pierce-stocked (sku×location) rows into
 * memory at once.
 *
 * Writes to two tables on each page:
 *   1. products — global (per-SKU) fields + PIER-compat pricing snapshot.
 *   2. product_inventory — one row per (SKU, LocationID).
 *
 * Reap (deleting rows that left Pierce stock) is a P1.9 concern. This phase
 * is intentionally additive-only — safe but not self-cleaning.
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

  // Phase 1: reap integration lands in P1.9. For now, allocate the bookkeeping.
  const seenSkus = new Set<number>();
  const seenInventoryKeys = new Set<string>();

  let lastSku = 0;
  let lastLoc = 0;
  while (true) {
    const result = await pool
      .request()
      .input("cursor", sql.Int, lastSku)
      .input("lastLoc", sql.Int, lastLoc)
      .input("pageSize", sql.Int, pageSize)
      .query<PrismPullRecord>(buildPrismPullPageQuery());

    if (result.recordset.length === 0) break;

    const { items, inventory } = shredRecordset(result.recordset);

    // Index inventory by sku for PIER-compat column lookup on products
    const invBySku = new Map<number, PrismInventoryRow>();
    for (const inv of inventory) {
      seenSkus.add(inv.sku);
      seenInventoryKeys.add(`${inv.sku}:${inv.locationId}`);
      if (inv.locationId === 2) invBySku.set(inv.sku, inv);
    }

    const productsUpsert = items.map((item) =>
      buildProductsUpsertPayload(item, invBySku.get(item.sku) ?? null),
    );
    if (productsUpsert.length > 0) {
      const { error: prodErr } = await supabase
        .from("products")
        .upsert(productsUpsert, { onConflict: "sku" });
      if (prodErr) throw new Error(`Supabase products upsert failed: ${prodErr.message}`);
    }

    const inventoryUpsert = inventory.map(buildProductInventoryUpsertPayload);
    if (inventoryUpsert.length > 0) {
      const { error: invErr } = await supabase
        .from("product_inventory")
        .upsert(inventoryUpsert, { onConflict: "sku,location_id" });
      if (invErr) throw new Error(`Supabase product_inventory upsert failed: ${invErr.message}`);
    }

    scanned += result.recordset.length;
    updated += productsUpsert.length + inventoryUpsert.length;

    const lastRow = result.recordset[result.recordset.length - 1];
    lastSku = lastRow.SKU;
    lastLoc = lastRow.LocationID;

    if (options.onProgress) options.onProgress(scanned);

    if (result.recordset.length < pageSize) break;
  }

  // Load existing inventory keys FROM BEFORE this sync started, then reap
  // anything we didn't see. Also reap products rows whose every location
  // dropped out (orphans).
  const existingInventoryKeys = await loadExistingInventoryKeys(supabase);
  const { inventoryToDelete, skusWithNoLocations } = computeReapSet(
    existingInventoryKeys,
    seenInventoryKeys,
  );

  // seenSkus is retained for future use (e.g. per-SKU reap audit logging).
  void seenSkus;

  let removed = 0;
  if (inventoryToDelete.size > 0) {
    const keys = Array.from(inventoryToDelete);
    for (let i = 0; i < keys.length; i += DELETE_CHUNK_SIZE) {
      const chunk = keys.slice(i, i + DELETE_CHUNK_SIZE);
      const orExpr = chunk.map((k) => {
        const [sku, loc] = k.split(":");
        return `and(sku.eq.${sku},location_id.eq.${loc})`;
      }).join(",");
      const { error: delErr, count } = await supabase
        .from("product_inventory")
        .delete({ count: "exact" })
        .or(orExpr);
      if (delErr) throw new Error(`product_inventory reap failed: ${delErr.message}`);
      removed += count ?? chunk.length;
    }
  }

  if (skusWithNoLocations.size > 0) {
    const skus = Array.from(skusWithNoLocations);
    for (let i = 0; i < skus.length; i += DELETE_CHUNK_SIZE) {
      const chunk = skus.slice(i, i + DELETE_CHUNK_SIZE);
      const { error: delErr, count } = await supabase
        .from("products")
        .delete({ count: "exact" })
        .in("sku", chunk);
      if (delErr) throw new Error(`products reap failed: ${delErr.message}`);
      removed += count ?? chunk.length;
    }
  }

  return {
    scanned,
    updated,
    removed,
    durationMs: Date.now() - started,
  };
}
