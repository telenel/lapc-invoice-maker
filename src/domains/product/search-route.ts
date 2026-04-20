import {
  getPrimaryProductLocationId,
  type ProductLocationId,
} from "./location-filters";
import type {
  Product,
  ProductBrowseRow,
  ProductLocationSlice,
  ProductLocationVariance,
} from "./types";

export interface ProductInventorySliceRow extends ProductLocationSlice {}

function hasVariedValue<T>(values: ReadonlyArray<T | null>): boolean {
  if (values.length <= 1) return false;

  const [first, ...rest] = values;
  return rest.some((value) => value !== first);
}

export function buildProductLocationVariance(
  slices: ReadonlyArray<ProductInventorySliceRow>,
): ProductLocationVariance {
  return {
    retailPriceVaries: hasVariedValue(slices.map((slice) => slice.retailPrice)),
    costVaries: hasVariedValue(slices.map((slice) => slice.cost)),
    stockVaries: hasVariedValue(slices.map((slice) => slice.stockOnHand)),
    lastSaleDateVaries: hasVariedValue(slices.map((slice) => slice.lastSaleDate)),
  };
}

export function buildProductBrowseRow(
  base: Product,
  slices: ReadonlyArray<ProductInventorySliceRow>,
  locationIds: ReadonlyArray<ProductLocationId>,
): ProductBrowseRow {
  const primaryLocationId = getPrimaryProductLocationId(locationIds);
  const primarySlice = slices.find((slice) => slice.locationId === primaryLocationId) ?? null;
  const selectedInventories = slices.map((slice) => ({ ...slice }));

  return {
    ...base,
    retail_price: primarySlice?.retailPrice ?? base.retail_price,
    cost: primarySlice?.cost ?? base.cost,
    stock_on_hand: primarySlice ? primarySlice.stockOnHand : base.stock_on_hand,
    last_sale_date: primarySlice ? primarySlice.lastSaleDate : base.last_sale_date,
    effective_last_sale_date:
      primarySlice?.lastSaleDate ??
      base.effective_last_sale_date ??
      base.last_sale_date_computed ??
      base.last_sale_date,
    primary_location_id: primarySlice?.locationId ?? null,
    primary_location_abbrev: primarySlice?.locationAbbrev ?? null,
    selected_inventories: selectedInventories,
    location_variance: buildProductLocationVariance(slices),
  };
}
