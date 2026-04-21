import { PRODUCT_LOCATION_ABBREV_BY_ID } from "./location-filters";
import type {
  ItemSnapshot,
} from "./types";
import {
  type InventoryMirrorSnapshotRow,
  type ProductUpdaterInput,
  getInventoryPatches,
  normalizeUpdaterInput,
} from "./prism-updates";

export function buildProductMirrorPayload(
  sku: number,
  patch: ProductUpdaterInput,
  snapshot: ItemSnapshot | null,
  includeTextbookFields: boolean,
): Record<string, unknown> {
  const normalizedPatch = normalizeUpdaterInput(patch);
  const payload: Record<string, unknown> = {
    sku,
    synced_at: new Date().toISOString(),
  };

  if (normalizedPatch.gm.description !== undefined) payload.description = normalizedPatch.gm.description;
  if (normalizedPatch.item.vendorId !== undefined) payload.vendor_id = normalizedPatch.item.vendorId;
  if (normalizedPatch.item.dccId !== undefined) payload.dcc_id = normalizedPatch.item.dccId;
  if (normalizedPatch.item.itemTaxTypeId !== undefined) payload.item_tax_type_id = normalizedPatch.item.itemTaxTypeId;
  if (normalizedPatch.gm.catalogNumber !== undefined) payload.catalog_number = normalizedPatch.gm.catalogNumber;
  if (normalizedPatch.item.comment !== undefined) payload.tx_comment = normalizedPatch.item.comment;
  if (normalizedPatch.item.weight !== undefined) payload.weight = normalizedPatch.item.weight;
  if (normalizedPatch.item.usedDccId !== undefined) payload.used_dcc_id = normalizedPatch.item.usedDccId;
  if (normalizedPatch.item.styleId !== undefined) payload.style_id = normalizedPatch.item.styleId;
  if (normalizedPatch.item.itemSeasonCodeId !== undefined) payload.item_season_code_id = normalizedPatch.item.itemSeasonCodeId;
  if (normalizedPatch.item.fListPriceFlag !== undefined) payload.f_list_price_flag = normalizedPatch.item.fListPriceFlag;
  if (normalizedPatch.item.fPerishable !== undefined) payload.f_perishable = normalizedPatch.item.fPerishable;
  if (normalizedPatch.item.fIdRequired !== undefined) payload.f_id_required = normalizedPatch.item.fIdRequired;
  if (normalizedPatch.item.minOrderQtyItem !== undefined) payload.min_order_qty_item = normalizedPatch.item.minOrderQtyItem;
  if (normalizedPatch.gm.imageUrl !== undefined) payload.image_url = normalizedPatch.gm.imageUrl;
  if (normalizedPatch.gm.unitsPerPack !== undefined) payload.units_per_pack = normalizedPatch.gm.unitsPerPack;
  if (normalizedPatch.gm.packageType !== undefined) payload.package_type = normalizedPatch.gm.packageType;
  if (normalizedPatch.gm.altVendorId !== undefined) payload.alt_vendor_id = normalizedPatch.gm.altVendorId;
  if (normalizedPatch.gm.mfgId !== undefined) payload.mfg_id = normalizedPatch.gm.mfgId;
  if (normalizedPatch.gm.size !== undefined) payload.size = normalizedPatch.gm.size;
  if (normalizedPatch.gm.colorId !== undefined) payload.color_id = normalizedPatch.gm.colorId;
  if (normalizedPatch.gm.orderIncrement !== undefined) payload.order_increment = normalizedPatch.gm.orderIncrement;

  if (includeTextbookFields) {
    if (normalizedPatch.textbook.author !== undefined) payload.author = normalizedPatch.textbook.author;
    if (normalizedPatch.textbook.title !== undefined) payload.title = normalizedPatch.textbook.title;
    if (normalizedPatch.textbook.isbn !== undefined) payload.isbn = normalizedPatch.textbook.isbn;
    if (normalizedPatch.textbook.edition !== undefined) payload.edition = normalizedPatch.textbook.edition;
    if (normalizedPatch.textbook.bindingId !== undefined) payload.binding_id = normalizedPatch.textbook.bindingId;
    if (normalizedPatch.textbook.imprint !== undefined) payload.imprint = normalizedPatch.textbook.imprint;
    if (normalizedPatch.textbook.copyright !== undefined) payload.copyright = normalizedPatch.textbook.copyright;
    if (normalizedPatch.textbook.textStatusId !== undefined) payload.text_status_id = normalizedPatch.textbook.textStatusId;
    if (normalizedPatch.textbook.statusDate !== undefined) payload.status_date = normalizedPatch.textbook.statusDate;
  }

  if (snapshot) {
    payload.barcode = snapshot.barcode;
    payload.retail_price = snapshot.retail;
    payload.cost = snapshot.cost;
    payload.discontinued = snapshot.fDiscontinue === 1;
  } else {
    if (normalizedPatch.item.barcode !== undefined) payload.barcode = normalizedPatch.item.barcode;
    const pierceInventoryPatch = getInventoryPatches(normalizedPatch).find((entry) => entry.locationId === 2);
    if (pierceInventoryPatch?.retail !== undefined) payload.retail_price = pierceInventoryPatch.retail;
    if (pierceInventoryPatch?.cost !== undefined) payload.cost = pierceInventoryPatch.cost;
    if (normalizedPatch.item.fDiscontinue !== undefined) payload.discontinued = normalizedPatch.item.fDiscontinue === 1;
  }

  return payload;
}

export function buildInventoryMirrorPayload(
  sku: number,
  rows: InventoryMirrorSnapshotRow[],
): Record<string, unknown>[] {
  const syncedAt = new Date().toISOString();

  return rows.map((entry) => {
    const payload: Record<string, unknown> = {
      sku,
      location_id: entry.locationId,
      location_abbrev: PRODUCT_LOCATION_ABBREV_BY_ID[entry.locationId],
      synced_at: syncedAt,
    };

    payload.retail_price = entry.retail;
    payload.cost = entry.cost;
    payload.expected_cost = entry.expectedCost;
    payload.tag_type_id = entry.tagTypeId;
    payload.status_code_id = entry.statusCodeId;
    payload.est_sales = entry.estSales;
    payload.est_sales_locked = entry.estSalesLocked;
    payload.f_inv_list_price_flag = entry.fInvListPriceFlag;
    payload.f_tx_want_list_flag = entry.fTxWantListFlag;
    payload.f_tx_buyback_list_flag = entry.fTxBuybackListFlag;
    payload.f_no_returns = entry.fNoReturns;

    return payload;
  });
}

export function buildInventoryMirrorPayloadFromPatch(
  sku: number,
  patch: ProductUpdaterInput,
): Record<string, unknown>[] {
  const syncedAt = new Date().toISOString();

  return getInventoryPatches(normalizeUpdaterInput(patch)).map((entry) => {
    const payload: Record<string, unknown> = {
      sku,
      location_id: entry.locationId,
      location_abbrev: PRODUCT_LOCATION_ABBREV_BY_ID[entry.locationId],
      synced_at: syncedAt,
    };

    if (entry.retail !== undefined) payload.retail_price = entry.retail;
    if (entry.cost !== undefined) payload.cost = entry.cost;
    if (entry.expectedCost !== undefined) payload.expected_cost = entry.expectedCost;
    if (entry.tagTypeId !== undefined) payload.tag_type_id = entry.tagTypeId;
    if (entry.statusCodeId !== undefined) payload.status_code_id = entry.statusCodeId;
    if (entry.estSales !== undefined) payload.est_sales = entry.estSales;
    if (entry.estSalesLocked !== undefined) payload.est_sales_locked = entry.estSalesLocked;
    if (entry.fInvListPriceFlag !== undefined) payload.f_inv_list_price_flag = entry.fInvListPriceFlag;
    if (entry.fTxWantListFlag !== undefined) payload.f_tx_want_list_flag = entry.fTxWantListFlag;
    if (entry.fTxBuybackListFlag !== undefined) payload.f_tx_buyback_list_flag = entry.fTxBuybackListFlag;
    if (entry.fNoReturns !== undefined) payload.f_no_returns = entry.fNoReturns;

    return payload;
  });
}
