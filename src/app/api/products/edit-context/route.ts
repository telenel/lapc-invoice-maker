import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadCommittedProductRefSnapshot } from "@/domains/product/ref-data-server";
import type { ProductEditDetails, ProductInventoryEditDetails } from "@/domains/product/types";
import type { ProductLocationId } from "@/domains/product/location-filters";
import { withAdmin } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  skus: z.array(z.number().int().positive()).min(1).max(200),
});

const LOCATION_IDS: readonly ProductLocationId[] = [2, 3, 4];
const LOCATION_ABBREV_BY_ID = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
} as const;

type ProductEditContextRow = {
  sku: number;
  item_type: string | null;
  description: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  binding_id: number | null;
  imprint: string | null;
  copyright: string | null;
  text_status_id: number | null;
  status_date: string | null;
  book_key: string | null;
  barcode: string | null;
  vendor_id: number | null;
  dcc_id: number | null;
  item_tax_type_id: number | null;
  catalog_number: string | null;
  tx_comment: string | null;
  retail_price: number | null;
  cost: number | null;
  discontinued: boolean | null;
  alt_vendor_id: number | null;
  mfg_id: number | null;
  weight: number | null;
  package_type: string | null;
  units_per_pack: number | null;
  order_increment: number | null;
  image_url: string | null;
  size: string | null;
  size_id: number | null;
  color_id: number | null;
  style_id: number | null;
  item_season_code_id: number | null;
  f_list_price_flag: boolean | null;
  f_perishable: boolean | null;
  f_id_required: boolean | null;
  min_order_qty_item: number | null;
  used_dcc_id: number | null;
  dept_name: string | null;
  class_name: string | null;
  cat_name: string | null;
};

type ProductInventoryRow = {
  sku: number;
  location_id: ProductLocationId;
  retail_price: number | null;
  cost: number | null;
  expected_cost: number | null;
  stock_on_hand: number | null;
  last_sale_date: string | null;
  tag_type_id: number | null;
  status_code_id: number | null;
  est_sales: number | null;
  est_sales_locked: boolean | null;
  f_inv_list_price_flag: boolean | null;
  f_tx_want_list_flag: boolean | null;
  f_tx_buyback_list_flag: boolean | null;
  f_no_returns: boolean | null;
};

function isProductEditContextRow(value: unknown): value is ProductEditContextRow {
  return value !== null && typeof value === "object" && typeof (value as { sku?: unknown }).sku === "number";
}

function isProductInventoryRow(value: unknown): value is ProductInventoryRow {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { sku?: unknown }).sku === "number" &&
    typeof (value as { location_id?: unknown }).location_id === "number"
  );
}

export interface ProductEditContextSummary {
  sku: number;
  displayName: string;
  barcode: string | null;
  vendorLabel: string | null;
  dccLabel: string | null;
  typeLabel: string;
}

export interface ProductEditContextItem {
  sku: number;
  itemType: string;
  summary: ProductEditContextSummary;
  global: ProductEditDetails;
  inventoryByLocation: ProductInventoryEditDetails[];
}

export interface ProductEditContextResponse {
  items: ProductEditContextItem[];
}

const PRODUCT_SELECT = [
  "sku",
  "item_type",
  "description",
  "author",
  "title",
  "isbn",
  "edition",
  "binding_id",
  "imprint",
  "copyright",
  "text_status_id",
  "status_date",
  "book_key",
  "barcode",
  "vendor_id",
  "dcc_id",
  "item_tax_type_id",
  "catalog_number",
  "tx_comment",
  "retail_price",
  "cost",
  "discontinued",
  "alt_vendor_id",
  "mfg_id",
  "weight",
  "package_type",
  "units_per_pack",
  "order_increment",
  "image_url",
  "size",
  "size_id",
  "color_id",
  "style_id",
  "item_season_code_id",
  "f_list_price_flag",
  "f_perishable",
  "f_id_required",
  "min_order_qty_item",
  "used_dcc_id",
  "dept_name",
  "class_name",
  "cat_name",
].join(", ");

const INVENTORY_SELECT = [
  "sku",
  "location_id",
  "retail_price",
  "cost",
  "expected_cost",
  "stock_on_hand",
  "last_sale_date",
  "tag_type_id",
  "status_code_id",
  "est_sales",
  "est_sales_locked",
  "f_inv_list_price_flag",
  "f_tx_want_list_flag",
  "f_tx_buyback_list_flag",
  "f_no_returns",
].join(", ");

function toProductEditDetails(row: ProductEditContextRow): ProductEditDetails {
  return {
    sku: row.sku,
    itemType: row.item_type ?? "general_merchandise",
    description: row.description,
    author: row.author,
    title: row.title,
    isbn: row.isbn,
    edition: row.edition,
    bindingId: row.binding_id,
    imprint: row.imprint,
    copyright: row.copyright,
    textStatusId: row.text_status_id,
    statusDate: row.status_date,
    bookKey: row.book_key,
    barcode: row.barcode,
    vendorId: row.vendor_id,
    dccId: row.dcc_id,
    itemTaxTypeId: row.item_tax_type_id,
    catalogNumber: row.catalog_number,
    comment: row.tx_comment,
    retail: row.retail_price,
    cost: row.cost,
    fDiscontinue: row.discontinued ? 1 : 0,
    altVendorId: row.alt_vendor_id,
    mfgId: row.mfg_id,
    weight: row.weight,
    packageType: row.package_type,
    unitsPerPack: row.units_per_pack,
    orderIncrement: row.order_increment,
    imageUrl: row.image_url,
    size: row.size,
    sizeId: row.size_id,
    colorId: row.color_id,
    styleId: row.style_id,
    itemSeasonCodeId: row.item_season_code_id,
    fListPriceFlag: row.f_list_price_flag === true,
    fPerishable: row.f_perishable === true,
    fIdRequired: row.f_id_required === true,
    minOrderQtyItem: row.min_order_qty_item,
    usedDccId: row.used_dcc_id,
    inventoryByLocation: [],
  };
}

function toInventoryDetails(row: ProductInventoryRow): ProductInventoryEditDetails {
  return {
    locationId: row.location_id,
    locationAbbrev: LOCATION_ABBREV_BY_ID[row.location_id],
    retail: row.retail_price,
    cost: row.cost,
    expectedCost: row.expected_cost,
    stockOnHand: row.stock_on_hand,
    lastSaleDate: row.last_sale_date,
    tagTypeId: row.tag_type_id,
    statusCodeId: row.status_code_id,
    estSales: row.est_sales,
    estSalesLocked: row.est_sales_locked === true,
    fInvListPriceFlag: row.f_inv_list_price_flag === true,
    fTxWantListFlag: row.f_tx_want_list_flag === true,
    fTxBuybackListFlag: row.f_tx_buyback_list_flag === true,
    fNoReturns: row.f_no_returns === true,
  };
}

function getDisplayName(row: ProductEditContextRow): string {
  const textbook = row.item_type === "textbook" || row.item_type === "used_textbook";
  const candidate = textbook ? row.title ?? row.description : row.description ?? row.title;
  return candidate?.trim() || `SKU ${row.sku}`;
}

function getTypeLabel(itemType: string | null): string {
  return itemType === "textbook" || itemType === "used_textbook" ? "Textbook" : "Merchandise";
}

function getDccLabel(row: ProductEditContextRow): string | null {
  const parts = [row.dept_name, row.class_name, row.cat_name]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" / ") : null;
}

export const POST = withAdmin(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { skus } = parsed.data;
    const supabase = getSupabaseAdminClient();
    const [productResult, inventoryResult, refs] = await Promise.all([
      supabase.from("products").select(PRODUCT_SELECT).in("sku", skus),
      supabase.from("product_inventory").select(INVENTORY_SELECT).in("sku", skus).in("location_id", LOCATION_IDS),
      loadCommittedProductRefSnapshot(),
    ]);

    if (productResult.error) {
      console.error("POST /api/products/edit-context product load failed:", productResult.error);
      return NextResponse.json({ error: "Failed to load edit context" }, { status: 500 });
    }

    if (inventoryResult.error) {
      console.error("POST /api/products/edit-context inventory load failed:", inventoryResult.error);
      return NextResponse.json({ error: "Failed to load edit context inventory" }, { status: 500 });
    }

    const rawRows = Array.isArray(productResult.data) ? (productResult.data as unknown[]) : [];
    const rows = rawRows.filter(isProductEditContextRow);
    const rowBySku = new Map(rows.map((row) => [row.sku, row]));
    const vendorLabelById = new Map(refs.vendors.map((vendor) => [vendor.vendorId, vendor.name] as const));
    const rawInventoryRows = Array.isArray(inventoryResult.data) ? (inventoryResult.data as unknown[]) : [];
    const inventoryRows = rawInventoryRows.filter(isProductInventoryRow);
    const inventoryBySku = new Map<number, ProductInventoryEditDetails[]>();

    inventoryRows.forEach((row) => {
      const current = inventoryBySku.get(row.sku) ?? [];
      current.push(toInventoryDetails(row));
      inventoryBySku.set(row.sku, current);
    });

    const items: ProductEditContextItem[] = skus.flatMap((sku) => {
      const row = rowBySku.get(sku);
      if (!row) return [];

      const global = toProductEditDetails(row);
      const inventoryByLocation = (inventoryBySku.get(sku) ?? []).sort((a, b) => a.locationId - b.locationId);

      return [
        {
          sku,
          itemType: global.itemType,
          summary: {
            sku,
            displayName: getDisplayName(row),
            barcode: row.barcode,
            vendorLabel: row.vendor_id != null ? (vendorLabelById.get(row.vendor_id) ?? null) : null,
            dccLabel: getDccLabel(row),
            typeLabel: getTypeLabel(row.item_type),
          },
          global: {
            ...global,
            inventoryByLocation,
          },
          inventoryByLocation,
        },
      ];
    });

    return NextResponse.json({ items } satisfies ProductEditContextResponse);
  } catch (error) {
    console.error("POST /api/products/edit-context threw:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
