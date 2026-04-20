import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildBulkPatchForRow } from "@/domains/bulk-edit/patch-builder";
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
import { isPrismConfigured } from "@/lib/prism";
import { prisma } from "@/lib/prisma";
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
  "item_type",
  "discontinued",
  "title",
  "author",
  "isbn",
  "edition",
  "binding_id",
  "catalog_number",
  "package_type",
  "units_per_pack",
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

function applySelectionFilters(
  query: any,
  selection: LegacySelection,
) {
  if (selection.filter?.q) query = query.ilike("description", `%${selection.filter.q}%`);
  if (selection.filter?.vendorId !== undefined) query = query.eq("vendor_id", selection.filter.vendorId);
  if (selection.filter?.dccId !== undefined) query = query.eq("dcc_id", selection.filter.dccId);
  if (selection.filter?.itemType) query = query.eq("item_type", selection.filter.itemType);
  if (selection.filter?.minRetail !== undefined) query = query.gte("retail_price", selection.filter.minRetail);
  if (selection.filter?.maxRetail !== undefined) query = query.lte("retail_price", selection.filter.maxRetail);
  if (selection.filter?.hasBarcode !== undefined) {
    query = selection.filter.hasBarcode ? query.not("barcode", "is", null) : query.is("barcode", null);
  }

  return query;
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
  item_type: string | null;
  discontinued: boolean | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  edition: string | null;
  binding_id: number | null;
  catalog_number: string | null;
  package_type: string | null;
  units_per_pack: number | null;
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

function normalizeNestedPatchFailure(
  status: number,
  body: unknown,
): { errors: Array<Record<string, unknown>>; status: number } {
  if (body && typeof body === "object" && Array.isArray((body as { errors?: unknown[] }).errors)) {
    return {
      errors: (body as { errors: Array<Record<string, unknown>> }).errors,
      status,
    };
  }

  if (body && typeof body === "object") {
    const typedBody = body as { error?: unknown; message?: unknown; current?: unknown };
    const code = typeof typedBody.error === "string" ? typedBody.error : "BULK_EDIT_COMMIT_FAILED";
    const message =
      typeof typedBody.message === "string"
        ? typedBody.message
        : typeof typedBody.error === "string"
          ? typedBody.error
          : "Bulk edit commit failed.";

    return {
      errors: [
        {
          code,
          message,
          ...(typedBody.current !== undefined ? { current: typedBody.current } : {}),
        },
      ],
      status,
    };
  }

  return {
    errors: [
      {
        code: "BULK_EDIT_COMMIT_FAILED",
        message: "Bulk edit commit failed.",
      },
    ],
    status,
  };
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
      console.error("bulk-edit commit: products select failed:", productResult.error);
      return { error: "Failed to load selection", status: 500 };
    }

    const rawProductRows = Array.isArray(productResult.data) ? (productResult.data as unknown[]) : [];
    const productRows = rawProductRows.filter(isProductRow);
    return loadInventoryRows(productRows, request.scope);
  }

  if (request.filter) {
    query = applySelectionFilters(query, request);
  }

  const productResult = await query.limit(2000).eq("discontinued", false);
  if (productResult.error) {
    console.error("bulk-edit commit: products select failed:", productResult.error);
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
    console.error("bulk-edit commit: product_inventory select failed:", inventoryResult.error);
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
      console.error("bulk-edit commit: legacy products select failed:", productResult.error);
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

  query = applySelectionFilters(query, selection);
  const productResult = await query.limit(2000);
  if (productResult.error) {
    console.error("bulk-edit commit: legacy products select failed:", productResult.error);
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

export const POST = withAdmin(async (request: NextRequest, session) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

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
    const sourceRowsBySku = new Map(sourceRowsResult.rows.map((row) => [row.sku, row] as const));
    const changedRows = preview.rows.filter((row) => row.changedFields.length > 0);

    if (changedRows.length === 0) {
      return NextResponse.json(
        {
          errors: [{ code: "NO_OP_TRANSFORM", message: "Every selected row would be unchanged — nothing to commit." }],
        },
        { status: 400 },
      );
    }

    const { PATCH: productPatchHandler } = await import("@/app/api/products/[sku]/route");
    const affectedSkus: number[] = [];

    for (const previewRow of changedRows) {
      const sourceRow = sourceRowsBySku.get(previewRow.sku);
      if (!sourceRow) {
        continue;
      }

      const built = buildBulkPatchForRow(sourceRow, parsed.data.transform);
      const nestedRequest = new NextRequest(new URL(`/api/products/${previewRow.sku}`, request.url), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          mode: "v2",
          patch: built.patch,
        }),
      });

      const nestedResponse = await productPatchHandler(nestedRequest, {
        params: Promise.resolve({ sku: String(previewRow.sku) }),
      });

      if (!nestedResponse.ok) {
        const nestedBody = await nestedResponse.json().catch(() => null);
        const normalizedFailure = normalizeNestedPatchFailure(nestedResponse.status, nestedBody);
        return NextResponse.json({ errors: normalizedFailure.errors }, { status: normalizedFailure.status });
      }

      affectedSkus.push(previewRow.sku);
    }

    const hadDistrictChanges = changedRows.some((row) =>
      row.changedFields.includes("dccId") || row.changedFields.includes("itemTaxTypeId"),
    );

    const run = await prisma.bulkEditRun.create({
      data: {
        operatorUserId: session.user.id,
        operatorDisplay: session.user.name ?? session.user.username ?? "unknown",
        selection: parsed.data.selection as never,
        transform: parsed.data.transform as never,
        affectedSkus,
        skuCount: affectedSkus.length,
        pricingDeltaCents: BigInt(0),
        hadDistrictChanges,
        summary: `Applied ${formatFieldLabelList(preview.changedFieldLabels)} to ${affectedSkus.length} item${affectedSkus.length === 1 ? "" : "s"}.`,
      },
    });

    return NextResponse.json({
      runId: run.id,
      successCount: affectedSkus.length,
      affectedSkus,
    });
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
  const batchRows = preview.rows
    .filter((row) => row.changedFields.length > 0)
    .map((row) => {
      const patch: Record<string, unknown> = {};
      if (row.changedFields.includes("retail")) patch.retail = row.after.retail;
      if (row.changedFields.includes("cost")) patch.cost = row.after.cost;
      if (row.changedFields.includes("dccId") && row.after.dccId !== null) patch.dccId = row.after.dccId;
      if (row.changedFields.includes("itemTaxTypeId") && row.after.itemTaxTypeId !== null) {
        patch.itemTaxTypeId = row.after.itemTaxTypeId;
      }
      return { sku: row.sku, patch, isTextbook: false };
    });

  if (batchRows.length === 0) {
    return NextResponse.json(
      {
        errors: [{ code: "NO_OP_TRANSFORM", message: "Every selected row would be unchanged — nothing to commit." }],
      },
      { status: 400 },
    );
  }

  const { POST: batchHandler } = await import("../../batch/route");
  const batchRequest = new NextRequest(new URL(request.url).origin + "/api/products/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ action: "update", rows: batchRows }),
  });
  const batchResponse = await batchHandler(batchRequest);
  const batchJson = await batchResponse.json().catch(() => null);

  if (!batchResponse.ok) {
    return NextResponse.json(batchJson ?? { error: "Batch commit failed" }, { status: batchResponse.status });
  }

  const summary = `${preview.totals.rowCount} items — retail delta $${(preview.totals.pricingDeltaCents / 100).toFixed(2)}${preview.totals.districtChangeCount > 0 ? `, ${preview.totals.districtChangeCount} district changes` : ""}`;

  const run = await prisma.bulkEditRun.create({
    data: {
      operatorUserId: session.user.id,
      operatorDisplay: session.user.name ?? session.user.username ?? "unknown",
      selection: parsed.data.selection as never,
      transform: transform as never,
      affectedSkus: batchRows.map((row) => row.sku),
      skuCount: batchRows.length,
      pricingDeltaCents: BigInt(preview.totals.pricingDeltaCents),
      hadDistrictChanges: preview.totals.districtChangeCount > 0,
      summary,
    },
  });

  return NextResponse.json({
    runId: run.id,
    successCount: batchRows.length,
    affectedSkus: batchRows.map((row) => row.sku),
  });
});

function formatFieldLabelList(labels: string[]): string {
  if (labels.length === 0) return "selected fields";
  if (labels.length === 1) return labels[0] ?? "selected fields";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
