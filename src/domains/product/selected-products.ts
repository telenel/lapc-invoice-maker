import type { ProductLocationId } from "./location-filters";
import type { ProductBrowseRow, SelectedProduct } from "./types";

export function getSelectedProductCacheKey(
  sku: number,
  locationId: ProductLocationId | null | undefined,
): string | null {
  if (locationId == null) {
    return null;
  }

  return `${sku}:${locationId}`;
}

export function browseRowToSelectedProduct(product: ProductBrowseRow): SelectedProduct {
  return {
    sku: product.sku,
    description: (product.title ?? product.description ?? "").toUpperCase(),
    retailPrice: product.retail_price,
    cost: product.cost,
    stockOnHand: product.stock_on_hand,
    pricingLocationId: product.primary_location_id ?? null,
    barcode: product.barcode,
    author: product.author,
    title: product.title,
    isbn: product.isbn,
    edition: product.edition,
    catalogNumber: product.catalog_number,
    vendorId: product.vendor_id,
    itemType: product.item_type,
    fDiscontinue: product.discontinued ? 1 : 0,
  };
}

export function selectedProductsEqual(left: SelectedProduct, right: SelectedProduct): boolean {
  return (
    left.sku === right.sku &&
    left.description === right.description &&
    left.retailPrice === right.retailPrice &&
    left.cost === right.cost &&
    (left.stockOnHand ?? null) === (right.stockOnHand ?? null) &&
    left.pricingLocationId === right.pricingLocationId &&
    left.barcode === right.barcode &&
    left.author === right.author &&
    left.title === right.title &&
    left.isbn === right.isbn &&
    left.edition === right.edition &&
    left.catalogNumber === right.catalogNumber &&
    left.vendorId === right.vendorId &&
    left.itemType === right.itemType &&
    left.fDiscontinue === right.fDiscontinue
  );
}
