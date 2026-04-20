import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildBulkFieldPreview } from "@/domains/bulk-edit/preview-builder";
import { bulkEditFieldRegistry } from "@/domains/bulk-edit/field-registry";
import { validateTransform } from "@/domains/bulk-edit/transform-engine";
import { buildPreview } from "@/domains/bulk-edit/preview-builder";
import { loadCommittedProductRefSnapshot } from "@/domains/product/ref-data-server";
import type {
  BulkEditFieldEditRequest,
  BulkEditFieldId,
  BulkEditFieldPickerRequest,
  BulkEditSourceInventoryRow,
  BulkEditSourceRow,
  BulkEditValidationError,
} from "@/domains/bulk-edit/types";
import type { ProductLocationId } from "@/domains/product/location-filters";
import { withAdmin } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PRODUCT_INVENTORY_LOCATION_IDS: readonly ProductLocationId[] = [2, 3, 4];

const PRODUCT_SELECT = [
  "sku",
  "description",
  "barcode",
  "retail_price",
  "cost",
  "vendor_id",
  "dcc_id",
  "item_tax_type_id",
  "tx_comment",
  "weight",
  "image_url",
  "alt_vendor_id",
  "mfg_id",
  "item_type",
  "discontinued",
  "size",
  "color_id",
  "style_id",
  "item_season_code_id",
  "f_list_price_flag",
  "f_perishable",
  "f_id_required",
  "min_order_qty_item",
  "used_dcc_id",
  "title",
  "author",
  "isbn",
  "edition",
  "binding_id",
  "catalog_number",
  "package_type",
  "units_per_pack",
  "order_increment",
].join(", ");

const PRODUCT_INVENTORY_SELECT = [
  "sku",
  "location_id",
  "retail_price",
  "cost",
  "expected_cost",
  "tag_type_id",
  "status_code_id",
  "est_sales",
  "est_sales_locked",
  "f_inv_list_price_flag",
  "f_tx_want_list_flag",
  "f_tx_buyback_list_flag",
  "f_no_returns",
].join(", ");

const BULK_EDIT_FIELD_IDS = Object.keys(bulkEditFieldRegistry) as [BulkEditFieldId, ...BulkEditFieldId[]];
const BULK_EDIT_FIELD_VALUE_SCHEMA = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const BULK_EDIT_VALUES_SHAPE = Object.fromEntries(
  BULK_EDIT_FIELD_IDS.map((fieldId) => [fieldId, BULK_EDIT_FIELD_VALUE_SCHEMA.optional()]),
) as Record<BulkEditFieldId, z.ZodOptional<typeof BULK_EDIT_FIELD_VALUE_SCHEMA>>;

const selectionSchema = z.object({
  filter: z
    .object({
      q: z.string().optional(),
      vendorId: z.number().int().optional(),
      dccId: z.number().int().optional(),
      itemType: z.enum(["textbook", "general_merchandise"]).optional(),
      minRetail: z.number().nonnegative().optional(),
      maxRetail: z.number().nonnegative().optional(),
      hasBarcode: z.boolean().optional(),
    })
    .optional(),
  skus: z.array(z.number().int().positive()).optional(),
  scope: z.enum(["pierce", "district"]).default("pierce"),
});

const fieldBodySchema = z.object({
  selection: selectionSchema,
  transform: z.object({
    fieldIds: z.array(z.enum(BULK_EDIT_FIELD_IDS)).min(1).max(5),
    inventoryScope: z.union([z.literal("primary"), z.literal("all"), z.literal(2), z.literal(3), z.literal(4), z.null()]),
    values: z.object(BULK_EDIT_VALUES_SHAPE).strict(),
  }),
});

const legacyPricingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("uplift"), percent: z.number() }),
  z.object({ mode: z.literal("absolute"), retail: z.number() }),
  z.object({ mode: z.literal("margin"), targetMargin: z.number() }),
  z.object({
    mode: z.literal("cost"),
    newCost: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("absolute"), value: z.number() }),
      z.object({ kind: z.literal("uplift"), percent: z.number() }),
    ]),
    preserveMargin: z.boolean(),
  }),
]);

const legacyTransformSchema = z.object({
  pricing: legacyPricingSchema,
  catalog: z.object({
    dccId: z.number().int().optional(),
    itemTaxTypeId: z.number().int().optional(),
  }),
});

const legacyBodySchema = z.object({
  selection: selectionSchema,
  transform: legacyTransformSchema,
});

type LegacySelection = z.infer<typeof selectionSchema>;

function isFieldPickerTransform(value: unknown): value is BulkEditFieldPickerRequest {
  return value !== null && typeof value === "object" && Array.isArray((value as { fieldIds?: unknown }).fieldIds);
}

type SourceProductRow = {
  sku: number;
  description: string | null;
  barcode: string | null;
  retail_price: number | null;
  cost: number | null;
  vendor_id: number | null;
  dcc_id: number | null;
  item_tax_type_id: number | null;
  tx_comment: string | null;
  weight: number | null;
  image_url: string | null;
  alt_vendor_id: number | null;
  mfg_id: number | null;
  item_type: string | null;
  discontinued: boolean | null;
  size: string | null;
  color_id: number | null;
  style_id: number | null;
  item_season_code_id: number | null;
  f_list_price_flag: boolean | null;
  f_perishable: boolean | null;
  f_id_required: boolean | null;
  min_order_qty_item: number | null;
  used_dcc_id: number | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  edition: string | null;
  binding_id: number | null;
  catalog_number: string | null;
  package_type: string | null;
  units_per_pack: number | null;
  order_increment: number | null;
};

type SourceInventoryRow = {
  sku: number;
  location_id: ProductLocationId;
  retail_price: number | null;
  cost: number | null;
  expected_cost: number | null;
  tag_type_id: number | null;
  status_code_id: number | null;
  est_sales: number | null;
  est_sales_locked: boolean | null;
  f_inv_list_price_flag: boolean | null;
  f_tx_want_list_flag: boolean | null;
  f_tx_buyback_list_flag: boolean | null;
  f_no_returns: boolean | null;
};

function isProductRow(value: unknown): value is SourceProductRow {
  return value !== null && typeof value === "object" && typeof (value as { sku?: unknown }).sku === "number";
}

function isInventoryRow(value: unknown): value is SourceInventoryRow {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { sku?: unknown }).sku === "number" &&
    typeof (value as { location_id?: unknown }).location_id === "number"
  );
}

function normalizeItemType(value: string | null): BulkEditSourceRow["itemType"] {
  if (
    value === "textbook" ||
    value === "used_textbook" ||
    value === "general_merchandise"
  ) {
    return value;
  }

  return null;
}

function toInventorySourceRow(row: SourceInventoryRow): BulkEditSourceInventoryRow {
  return {
    locationId: row.location_id,
    retail: row.retail_price,
    cost: row.cost,
    expectedCost: row.expected_cost,
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

function resolvePrimaryLocationId(
  inventoryRows: readonly BulkEditSourceInventoryRow[],
  scope: BulkEditFieldEditRequest["selection"]["scope"],
): ProductLocationId {
  if (inventoryRows.some((row) => row.locationId === 2)) {
    return 2;
  }

  if (scope === "district") {
    return inventoryRows[0]?.locationId ?? 2;
  }

  return inventoryRows[0]?.locationId ?? 2;
}

function validateFieldPicker(transform: BulkEditFieldPickerRequest): BulkEditValidationError[] {
  const needsInventoryScope = transform.fieldIds.some((fieldId) => bulkEditFieldRegistry[fieldId].requiresLocation);

  if (needsInventoryScope && transform.inventoryScope === null) {
    return [
      {
        code: "MISSING_INVENTORY_SCOPE",
        field: "inventoryScope",
        message: "Choose an inventory scope when editing location-aware inventory fields.",
      },
    ];
  }

  return [];
}

async function loadSourceRows(
  request: BulkEditFieldEditRequest["selection"],
): Promise<{ rows: BulkEditSourceRow[] } | { error: string; status: number }> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("products").select(PRODUCT_SELECT);

  if (request.skus && request.skus.length > 0) {
    query = query.limit(2000);
    const productResult = await query.in("sku", request.skus);
    if (productResult.error) {
      console.error("bulk-edit dry-run: products select failed:", productResult.error);
      return { error: "Failed to load selection", status: 500 };
    }

    const rawProductRows = Array.isArray(productResult.data) ? (productResult.data as unknown[]) : [];
    const productRows = rawProductRows.filter(isProductRow);
    return loadInventoryRows(productRows, request.scope);
  }

  if (request.filter) {
    if (request.filter.q) query = query.ilike("description", `%${request.filter.q}%`);
    if (request.filter.vendorId !== undefined) query = query.eq("vendor_id", request.filter.vendorId);
    if (request.filter.dccId !== undefined) query = query.eq("dcc_id", request.filter.dccId);
    if (request.filter.itemType) query = query.eq("item_type", request.filter.itemType);
    if (request.filter.minRetail !== undefined) query = query.gte("retail_price", request.filter.minRetail);
    if (request.filter.maxRetail !== undefined) query = query.lte("retail_price", request.filter.maxRetail);
    if (request.filter.hasBarcode !== undefined) {
      query = request.filter.hasBarcode ? query.not("barcode", "is", null) : query.is("barcode", null);
    }
  }

  const productResult = await query.limit(2000).eq("discontinued", false);
  if (productResult.error) {
    console.error("bulk-edit dry-run: products select failed:", productResult.error);
    return { error: "Failed to load selection", status: 500 };
  }

  const rawProductRows = Array.isArray(productResult.data) ? (productResult.data as unknown[]) : [];
  const productRows = rawProductRows.filter(isProductRow);
  return loadInventoryRows(productRows, request.scope);
}

async function loadInventoryRows(
  productRows: SourceProductRow[],
  scope: BulkEditFieldEditRequest["selection"]["scope"],
): Promise<{ rows: BulkEditSourceRow[] } | { error: string; status: number }> {
  if (productRows.length === 0) {
    return { rows: [] };
  }

  const supabase = getSupabaseAdminClient();
  const skus = productRows.map((row) => row.sku);
  const inventoryResult = await supabase
    .from("product_inventory")
    .select(PRODUCT_INVENTORY_SELECT)
    .in("sku", skus)
    .in("location_id", PRODUCT_INVENTORY_LOCATION_IDS);

  if (inventoryResult.error) {
    console.error("bulk-edit dry-run: product_inventory select failed:", inventoryResult.error);
    return { error: "Failed to load selection inventory", status: 500 };
  }

  const rawInventoryRows = Array.isArray(inventoryResult.data) ? (inventoryResult.data as unknown[]) : [];
  const inventoryRows = rawInventoryRows.filter(isInventoryRow);
  const inventoryBySku = new Map<number, BulkEditSourceInventoryRow[]>();

  for (const inventoryRow of inventoryRows) {
    const current = inventoryBySku.get(inventoryRow.sku) ?? [];
    current.push(toInventorySourceRow(inventoryRow));
    inventoryBySku.set(inventoryRow.sku, current);
  }

  return {
    rows: productRows.map((row) => {
      const productInventory = inventoryBySku.get(row.sku) ?? [];

      return {
        sku: row.sku,
        description: row.description ?? "",
        barcode: row.barcode,
        retail: Number(row.retail_price ?? 0),
        cost: Number(row.cost ?? 0),
        vendorId: row.vendor_id,
        dccId: row.dcc_id,
        itemTaxTypeId: row.item_tax_type_id,
        itemType: normalizeItemType(row.item_type),
        fDiscontinue: row.discontinued ? 1 : 0,
        comment: row.tx_comment,
        weight: row.weight,
        imageUrl: row.image_url,
        altVendorId: row.alt_vendor_id,
        mfgId: row.mfg_id,
        size: row.size,
        colorId: row.color_id,
        styleId: row.style_id,
        itemSeasonCodeId: row.item_season_code_id,
        orderIncrement: row.order_increment,
        usedDccId: row.used_dcc_id,
        minOrderQtyItem: row.min_order_qty_item,
        fListPriceFlag: row.f_list_price_flag === true,
        fPerishable: row.f_perishable === true,
        fIdRequired: row.f_id_required === true,
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        edition: row.edition,
        bindingId: row.binding_id,
        catalogNumber: row.catalog_number,
        packageType: row.package_type,
        unitsPerPack: row.units_per_pack,
        primaryLocationId: resolvePrimaryLocationId(productInventory, scope),
        inventoryByLocation: productInventory,
      };
    }),
  };
}

async function loadLegacySourceRows(
  selection: LegacySelection,
): Promise<{ rows: BulkEditSourceRow[] } | { error: string; status: number }> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("products").select(
    "sku, description, barcode, retail_price, cost, vendor_id, dcc_id, item_tax_type_id, item_type, discontinued",
  );

  if (selection.skus && selection.skus.length > 0) {
    const productResult = await query.limit(2000).in("sku", selection.skus);
    if (productResult.error) {
      console.error("bulk-edit dry-run: legacy products select failed:", productResult.error);
      return { error: "Failed to load selection", status: 500 };
    }

    const rawProductRows = Array.isArray(productResult.data) ? (productResult.data as unknown[]) : [];
    const productRows = rawProductRows.filter(isProductRow);
    return {
      rows: productRows.map((row) => ({
        sku: row.sku,
        description: row.description ?? "",
        barcode: row.barcode,
        retail: Number(row.retail_price ?? 0),
        cost: Number(row.cost ?? 0),
        vendorId: row.vendor_id,
        dccId: row.dcc_id,
        itemTaxTypeId: row.item_tax_type_id,
        itemType: normalizeItemType(row.item_type),
        fDiscontinue: row.discontinued ? 1 : 0,
      })),
    };
  }

  if (selection.filter?.q) query = query.ilike("description", `%${selection.filter.q}%`);
  if (selection.filter?.vendorId !== undefined) query = query.eq("vendor_id", selection.filter.vendorId);
  if (selection.filter?.dccId !== undefined) query = query.eq("dcc_id", selection.filter.dccId);
  if (selection.filter?.itemType) query = query.eq("item_type", selection.filter.itemType);
  if (selection.filter?.minRetail !== undefined) query = query.gte("retail_price", selection.filter.minRetail);
  if (selection.filter?.maxRetail !== undefined) query = query.lte("retail_price", selection.filter.maxRetail);
  if (selection.filter?.hasBarcode !== undefined) {
    query = selection.filter.hasBarcode ? query.not("barcode", "is", null) : query.is("barcode", null);
  }
  const productResult = await query.limit(2000);
  if (productResult.error) {
    console.error("bulk-edit dry-run: legacy products select failed:", productResult.error);
    return { error: "Failed to load selection", status: 500 };
  }

  const rawProductRows = Array.isArray(productResult.data) ? (productResult.data as unknown[]) : [];
  const productRows = rawProductRows.filter(isProductRow);
  return {
    rows: productRows.map((row) => ({
      sku: row.sku,
      description: row.description ?? "",
      barcode: row.barcode,
      retail: Number(row.retail_price ?? 0),
      cost: Number(row.cost ?? 0),
      vendorId: row.vendor_id,
      dccId: row.dcc_id,
      itemTaxTypeId: row.item_tax_type_id,
      itemType: normalizeItemType(row.item_type),
      fDiscontinue: row.discontinued ? 1 : 0,
    })),
  };
}

export const POST = withAdmin(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (isFieldPickerTransform((body as { transform?: unknown }).transform)) {
    const parsed = fieldBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const validationErrors = validateFieldPicker(parsed.data.transform);
    if (validationErrors.length > 0) {
      return NextResponse.json({ errors: validationErrors }, { status: 400 });
    }

    const sourceRowsResult = await loadSourceRows(parsed.data.selection);
    if ("error" in sourceRowsResult) {
      return NextResponse.json({ error: sourceRowsResult.error }, { status: sourceRowsResult.status });
    }

    if (sourceRowsResult.rows.length === 0) {
      return NextResponse.json(
        {
          errors: [{ code: "EMPTY_SELECTION", message: "Selection resolved to zero items." }],
        },
        { status: 400 },
      );
    }

    const refs = await loadCommittedProductRefSnapshot().catch(() => null);
    const preview = buildBulkFieldPreview(sourceRowsResult.rows, parsed.data.transform, refs);
    return NextResponse.json(preview);
  }

  const parsed = legacyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const transform = parsed.data.transform;
  const transformErrors = validateTransform(transform);
  if (transformErrors.length > 0) {
    return NextResponse.json({ errors: transformErrors }, { status: 400 });
  }

  const sourceRowsResult = await loadLegacySourceRows(parsed.data.selection);
  if ("error" in sourceRowsResult) {
    return NextResponse.json({ error: sourceRowsResult.error }, { status: sourceRowsResult.status });
  }

  if (sourceRowsResult.rows.length === 0) {
    return NextResponse.json(
      {
        errors: [{ code: "EMPTY_SELECTION", message: "Selection resolved to zero items." }],
      },
      { status: 400 },
    );
  }

  const preview = buildPreview(sourceRowsResult.rows, transform);
  return NextResponse.json(preview);
});
