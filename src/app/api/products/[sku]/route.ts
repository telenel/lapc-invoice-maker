import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import type {
  ItemSnapshot,
  ProductEditDetails,
  ProductEditPatchV2,
  ProductInventoryEditDetails,
  InventoryPatchPerLocation,
  ProductLocationAbbrev,
  ItemPatch,
  GmDetailsPatch,
  PrimaryInventoryPatch,
} from "@/domains/product/types";
import type { ProductLocationId } from "@/domains/product/location-filters";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ sku: string }> };

type ProductEditDetailRow = {
  sku: number;
  item_type: string;
  description: string | null;
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
};

type ProductInventoryEditDetailRow = {
  location_id: ProductLocationId;
  location_abbrev: string | null;
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

type ProductPatchKindRow = {
  item_type: string | null;
};

const PRODUCT_INVENTORY_LOCATION_IDS: readonly ProductLocationId[] = [2, 3, 4];
const PRODUCT_INVENTORY_LOCATION_ABBREV_BY_ID: Record<ProductLocationId, ProductLocationAbbrev> = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
};

const PRODUCT_INVENTORY_SELECT = [
  "location_id",
  "location_abbrev",
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

const PRODUCT_EDIT_DETAIL_SELECT = [
  "sku",
  "item_type",
  "description",
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
].join(", ");

const TEXTBOOK_ITEM_TYPES = new Set(["textbook", "used_textbook"]);

function parseSkuParam(rawSku: string): number | null {
  const sku = Number(rawSku);
  if (!Number.isInteger(sku) || sku <= 0) {
    return null;
  }
  return sku;
}

function isProductInventoryEditDetailRow(row: unknown): row is ProductInventoryEditDetailRow {
  return (
    row !== null &&
    typeof row === "object" &&
    "location_id" in row &&
    (row as { location_id?: unknown }).location_id !== null &&
    typeof (row as { location_id?: unknown }).location_id === "number"
  );
}

function toProductEditDetails(row: ProductEditDetailRow): ProductEditDetails {
  return {
    sku: row.sku,
    itemType: row.item_type,
    description: row.description,
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

function toProductInventoryEditDetails(
  row: ProductInventoryEditDetailRow,
): ProductInventoryEditDetails {
  const locationAbbrev = PRODUCT_INVENTORY_LOCATION_ABBREV_BY_ID[row.location_id];

  return {
    locationId: row.location_id,
    locationAbbrev,
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

function buildEmptyInventorySlice(locationId: ProductLocationId): ProductInventoryEditDetails {
  return {
    locationId,
    locationAbbrev: PRODUCT_INVENTORY_LOCATION_ABBREV_BY_ID[locationId],
    retail: null,
    cost: null,
    expectedCost: null,
    stockOnHand: null,
    lastSaleDate: null,
    tagTypeId: null,
    statusCodeId: null,
    estSales: null,
    estSalesLocked: false,
    fInvListPriceFlag: false,
    fTxWantListFlag: false,
    fTxBuybackListFlag: false,
    fNoReturns: false,
  };
}

function buildInventoryByLocation(
  rows: ReadonlyArray<ProductInventoryEditDetailRow>,
): ProductInventoryEditDetails[] {
  const rowsByLocation = new Map<ProductLocationId, ProductInventoryEditDetailRow>();
  for (const row of rows) {
    rowsByLocation.set(row.location_id, row);
  }

  return PRODUCT_INVENTORY_LOCATION_IDS.map((locationId) => {
    const row = rowsByLocation.get(locationId);
    return row ? toProductInventoryEditDetails(row) : buildEmptyInventorySlice(locationId);
  });
}

function narrowInventoryDetailRows(rows: unknown): ProductInventoryEditDetailRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter(isProductInventoryEditDetailRow);
}

async function loadDeleteDeps() {
  const [{ isPrismConfigured }, { discontinueItem, deleteTestItem }] = await Promise.all([
    import("@/lib/prism"),
    import("@/domains/product/prism-server"),
  ]);

  return { isPrismConfigured, discontinueItem, deleteTestItem };
}

async function loadPatchDeps() {
  const [{ isPrismConfigured }, { updateGmItem, updateTextbookPricing, getItemSnapshot }] = await Promise.all([
    import("@/lib/prism"),
    import("@/domains/product/prism-updates"),
  ]);

  return { isPrismConfigured, updateGmItem, updateTextbookPricing, getItemSnapshot };
}

export const GET = withAdmin(async (_request: NextRequest, _session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const sku = parseSkuParam(params?.sku ?? "");
  if (sku === null) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_EDIT_DETAIL_SELECT)
      .eq("sku", sku)
      .maybeSingle<ProductEditDetailRow>();

    if (error) {
      console.error(`GET /api/products/${sku} failed:`, error);
      return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const inventoryResult = await supabase
      .from("product_inventory")
      .select(PRODUCT_INVENTORY_SELECT)
      .eq("sku", sku)
      .in("location_id", PRODUCT_INVENTORY_LOCATION_IDS);
    const inventoryRows = narrowInventoryDetailRows(inventoryResult.data);
    const inventoryError = inventoryResult.error;

    if (inventoryError) {
      console.error(`GET /api/products/${sku} inventory load failed:`, inventoryError);
      return NextResponse.json({ error: "Failed to load item inventory" }, { status: 500 });
    }

    return NextResponse.json({
      ...toProductEditDetails(data),
      inventoryByLocation: buildInventoryByLocation(inventoryRows),
    });
  } catch (err) {
    console.error(`GET /api/products/${sku} threw:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});

/**
 * Soft-delete an item by setting fDiscontinue=1 (default), or hard-delete if
 * the URL has `?hard=true` AND the item's barcode starts with TEST-CLAUDE-.
 *
 * The hard-delete is restricted to test items because real items have FK
 * dependencies (Inventory, Transaction_Detail, etc.) that would block deletion
 * and could cause data integrity issues if removed.
 */
export const DELETE = withAdmin(async (request: NextRequest, _session, ctx?: RouteCtx) => {
  const { isPrismConfigured, deleteTestItem, discontinueItem } = await loadDeleteDeps();
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const params = ctx ? await ctx.params : null;
  const sku = parseSkuParam(params?.sku ?? "");
  if (sku === null) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  const url = new URL(request.url);
  const hard = url.searchParams.get("hard") === "true";

  try {
    const result = hard ? await deleteTestItem(sku) : await discontinueItem(sku);

    if (result.affected === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Mirror to Supabase. For soft delete we just upsert the discontinue flag
    // (the products table doesn't have one — we just delete the row to hide it
    // from the UI; nightly sync will restore it but that's OK since the read
    // page filters on whatever Prism shows).
    try {
      const supabase = getSupabaseAdminClient();
      if (hard) {
        await supabase.from("products").delete().eq("sku", sku);
      }
      // Soft delete: leave the row, the UI shouldn't show discontinued items.
      // (A future migration could add a `discontinued` boolean to products.)
    } catch (mirrorErr) {
      console.warn(`[DELETE /api/products/${sku}] mirror failed:`, mirrorErr);
    }

    return NextResponse.json({ sku, mode: hard ? "hard" : "soft", affected: result.affected });
  } catch (err) {
    console.error(`DELETE /api/products/${sku} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});

const snapshotSchema = z.object({
  sku: z.number().int().positive(),
  barcode: z.string().nullable(),
  retail: z.number().nonnegative().nullable(),
  cost: z.number().nonnegative().nullable(),
  fDiscontinue: z.union([z.literal(0), z.literal(1)]),
});

const itemPatchSchema = z.object({
  barcode: z.string().max(20).nullable().optional(),
  vendorId: z.number().int().positive().optional(),
  dccId: z.number().int().positive().optional(),
  itemTaxTypeId: z.number().int().positive().optional(),
  comment: z.string().max(25).nullable().optional(),
  weight: z.number().nonnegative().optional(),
  fDiscontinue: z.union([z.literal(0), z.literal(1)]).optional(),
});

const gmDetailsPatchSchema = z.object({
  description: z.string().min(1).max(128).optional(),
  catalogNumber: z.string().max(30).nullable().optional(),
  packageType: z.string().max(3).nullable().optional(),
  unitsPerPack: z.number().int().positive().optional(),
  imageUrl: z.string().max(128).nullable().optional(),
});

const primaryInventoryPatchSchema = z.object({
  retail: z.number().nonnegative().nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
});

const inventoryPatchLocationIdSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);

const inventoryPatchPerLocationSchema = z.object({
  locationId: inventoryPatchLocationIdSchema,
  retail: z.number().nonnegative().nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  expectedCost: z.number().nonnegative().nullable().optional(),
  tagTypeId: z.number().int().positive().nullable().optional(),
  statusCodeId: z.number().int().positive().nullable().optional(),
  estSales: z.number().nullable().optional(),
  estSalesLocked: z.boolean().optional(),
  fInvListPriceFlag: z.boolean().optional(),
  fTxWantListFlag: z.boolean().optional(),
  fTxBuybackListFlag: z.boolean().optional(),
  fNoReturns: z.boolean().optional(),
});

const inventoryPatchArraySchema = z.array(inventoryPatchPerLocationSchema).superRefine((entries, ctx) => {
  const seen = new Set<number>();
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.locationId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate inventory locationId entries are not allowed.",
        path: [index, "locationId"],
      });
      continue;
    }
    seen.add(entry.locationId);
  }
});

const legacyPatchFieldsSchema = z.object({
  description: z.string().min(1).max(128).optional(),
  vendorId: z.number().int().positive().optional(),
  dccId: z.number().int().positive().optional(),
  itemTaxTypeId: z.number().int().positive().optional(),
  barcode: z.string().max(20).nullable().optional(),
  catalogNumber: z.string().max(30).nullable().optional(),
  comment: z.string().max(25).nullable().optional(),
  weight: z.number().nonnegative().optional(),
  imageUrl: z.string().max(128).nullable().optional(),
  unitsPerPack: z.number().int().positive().optional(),
  packageType: z.string().max(3).nullable().optional(),
  retail: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  fDiscontinue: z.union([z.literal(0), z.literal(1)]).optional(),
});

const legacyPatchSchema = z.object({
  isTextbook: z.boolean().optional(),
  baseline: snapshotSchema.optional(),
  patch: legacyPatchFieldsSchema,
});

const v2PatchSchema = z.object({
  item: itemPatchSchema.optional(),
  gm: gmDetailsPatchSchema.optional(),
  inventory: inventoryPatchArraySchema.optional(),
  primaryInventory: primaryInventoryPatchSchema.optional(),
});

const v2BodySchema = z.object({
  mode: z.literal("v2"),
  baseline: snapshotSchema.optional(),
  patch: v2PatchSchema,
});

type LegacyPatchInput = z.infer<typeof legacyPatchFieldsSchema>;
type NormalizedUpdateCommand = {
  baseline?: ItemSnapshot;
  isTextbook: boolean;
  patch: ProductEditPatchV2;
  isV2: boolean;
};

function hasWritableFields<T extends object>(patch: T | undefined): patch is T {
  return Object.values(patch ?? {}).some((value) => value !== undefined);
}

function hasAnyWritablePatchFields(patch: ProductEditPatchV2): boolean {
  return (
    hasWritableFields(patch.item) ||
    hasWritableFields(patch.gm) ||
    hasWritableInventoryFields(patch.inventory)
  );
}

function hasWritableInventoryFields(patch: InventoryPatchPerLocation[] | undefined): boolean {
  return (patch ?? []).some((entry) =>
    [
      entry.retail,
      entry.cost,
      entry.expectedCost,
      entry.tagTypeId,
      entry.statusCodeId,
      entry.estSales,
      entry.estSalesLocked,
      entry.fInvListPriceFlag,
      entry.fTxWantListFlag,
      entry.fTxBuybackListFlag,
      entry.fNoReturns,
    ].some((value) => value !== undefined),
  );
}

function normalizeV2Patch(patch: z.infer<typeof v2PatchSchema>): ProductEditPatchV2 {
  if (patch.inventory !== undefined) {
    return {
      item: patch.item,
      gm: patch.gm,
      inventory: patch.inventory,
    };
  }

  const primaryInventory: PrimaryInventoryPatch = {
    retail: patch.primaryInventory?.retail,
    cost: patch.primaryInventory?.cost,
  };

  return {
    item: patch.item,
    gm: patch.gm,
    inventory: hasWritableFields(primaryInventory)
      ? [
          {
            locationId: 2,
            ...primaryInventory,
          },
        ]
      : undefined,
  };
}

function normalizeLegacyPatch(patch: LegacyPatchInput): ProductEditPatchV2 {
  const item: ItemPatch = {
    barcode: patch.barcode,
    vendorId: patch.vendorId,
    dccId: patch.dccId,
    itemTaxTypeId: patch.itemTaxTypeId,
    comment: patch.comment,
    weight: patch.weight,
    fDiscontinue: patch.fDiscontinue,
  };
  const gm: GmDetailsPatch = {
    description: patch.description,
    catalogNumber: patch.catalogNumber,
    packageType: patch.packageType,
    unitsPerPack: patch.unitsPerPack,
    imageUrl: patch.imageUrl,
  };
  const primaryInventory: PrimaryInventoryPatch = {
    retail: patch.retail,
    cost: patch.cost,
  };

  return {
    item: hasWritableFields(item) ? item : undefined,
    gm: hasWritableFields(gm) ? gm : undefined,
    inventory: hasWritableFields(primaryInventory)
      ? [
          {
            locationId: 2,
            ...primaryInventory,
          },
        ]
      : undefined,
  };
}

function normalizePatchBody(body: unknown): { success: true; data: NormalizedUpdateCommand } | { success: false; error: unknown } {
  if (body && typeof body === "object" && "mode" in body && (body as { mode?: unknown }).mode === "v2") {
    const parsed = v2BodySchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten() };
    }
    return {
      success: true,
      data: {
        baseline: parsed.data.baseline,
        isTextbook: false,
        patch: normalizeV2Patch(parsed.data.patch),
        isV2: true,
      },
    };
  }

  const parsed = legacyPatchSchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten() };
  }

  return {
    success: true,
    data: {
      baseline: parsed.data.baseline,
      isTextbook: parsed.data.isTextbook === true,
      patch: normalizeLegacyPatch(parsed.data.patch),
      isV2: false,
    },
  };
}

function buildLegacyMirrorPayload(
  sku: number,
  patch: ProductEditPatchV2,
  snapshot: ItemSnapshot | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    sku,
    synced_at: new Date().toISOString(),
  };

  if (patch.gm?.description !== undefined) payload.description = patch.gm.description;
  if (patch.item?.vendorId !== undefined) payload.vendor_id = patch.item.vendorId;
  if (patch.item?.dccId !== undefined) payload.dcc_id = patch.item.dccId;
  if (patch.item?.itemTaxTypeId !== undefined) payload.item_tax_type_id = patch.item.itemTaxTypeId;
  if (patch.gm?.catalogNumber !== undefined) payload.catalog_number = patch.gm.catalogNumber;
  if (patch.item?.comment !== undefined) payload.tx_comment = patch.item.comment;
  if (patch.item?.weight !== undefined) payload.weight = patch.item.weight;
  if (patch.gm?.imageUrl !== undefined) payload.image_url = patch.gm.imageUrl;
  if (patch.gm?.unitsPerPack !== undefined) payload.units_per_pack = patch.gm.unitsPerPack;
  if (patch.gm?.packageType !== undefined) payload.package_type = patch.gm.packageType;

  if (snapshot) {
    payload.barcode = snapshot.barcode;
    payload.retail_price = snapshot.retail;
    payload.cost = snapshot.cost;
    payload.discontinued = snapshot.fDiscontinue === 1;
  } else {
    if (patch.item?.barcode !== undefined) payload.barcode = patch.item.barcode;
    const pierceInventoryPatch = patch.inventory?.find((entry) => entry.locationId === 2) ?? patch.primaryInventory;
    if (pierceInventoryPatch?.retail !== undefined) payload.retail_price = pierceInventoryPatch.retail;
    if (pierceInventoryPatch?.cost !== undefined) payload.cost = pierceInventoryPatch.cost;
    if (patch.item?.fDiscontinue !== undefined) payload.discontinued = patch.item.fDiscontinue === 1;
  }

  return payload;
}

function buildInventoryMirrorPayload(
  sku: number,
  inventory: ReadonlyArray<InventoryPatchPerLocation> | undefined,
): Record<string, unknown>[] {
  const syncedAt = new Date().toISOString();

  return (inventory ?? []).map((entry) => {
    const payload: Record<string, unknown> = {
      sku,
      location_id: entry.locationId,
      location_abbrev: PRODUCT_INVENTORY_LOCATION_ABBREV_BY_ID[entry.locationId],
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

export const PATCH = withAdmin(async (request: NextRequest, _session, ctx?: RouteCtx) => {
  const { isPrismConfigured, updateGmItem, updateTextbookPricing, getItemSnapshot } = await loadPatchDeps();
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const params = ctx ? await ctx.params : null;
  const sku = parseSkuParam(params?.sku ?? "");
  if (sku === null) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const normalized = normalizePatchBody(body);
  if (!normalized.success) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  if (!hasAnyWritablePatchFields(normalized.data.patch)) {
    return NextResponse.json({ error: "PATCH body must include at least one writable field." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (normalized.data.isV2) {
      const { data: kindRow, error: kindError } = await supabase
        .from("products")
        .select("item_type")
        .eq("sku", sku)
        .maybeSingle<ProductPatchKindRow>();

      if (kindError) {
        console.error(`PATCH /api/products/${sku} kind lookup failed:`, kindError);
        return NextResponse.json({ error: "Failed to load item type" }, { status: 500 });
      }
      if (!kindRow) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      if (TEXTBOOK_ITEM_TYPES.has(kindRow.item_type ?? "")) {
        return NextResponse.json(
          { error: "V2 PATCH does not support textbook SKUs. Use the legacy textbook-safe payload." },
          { status: 400 },
        );
      }
    }

    const result = normalized.data.isTextbook
      ? await updateTextbookPricing(sku, normalized.data.patch, normalized.data.baseline)
      : await updateGmItem(sku, normalized.data.patch, normalized.data.baseline);

    // Non-blocking Supabase mirror
    try {
      const snap = await getItemSnapshot(sku);
      await supabase.from("products").upsert(buildLegacyMirrorPayload(sku, normalized.data.patch, snap));
      const inventoryMirrorPayload = buildInventoryMirrorPayload(sku, normalized.data.patch.inventory);
      if (inventoryMirrorPayload.length > 0) {
        await supabase.from("product_inventory").upsert(inventoryMirrorPayload);
      }
    } catch (mirrorErr) {
      console.warn(`[PATCH /api/products/${sku}] mirror failed:`, mirrorErr);
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "CONCURRENT_MODIFICATION") {
      const current = (err as Error & { current?: unknown }).current;
      return NextResponse.json({ error: "CONCURRENT_MODIFICATION", current }, { status: 409 });
    }
    console.error(`PATCH /api/products/${sku} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
