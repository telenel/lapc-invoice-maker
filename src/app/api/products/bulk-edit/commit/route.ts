import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTransform } from "@/domains/bulk-edit/transform-engine";
import { buildPreview } from "@/domains/bulk-edit/preview-builder";
import type { BulkEditSourceRow, BulkEditTransform } from "@/domains/bulk-edit/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  selection: z.object({
    filter: z.record(z.string(), z.any()).optional(),
    skus: z.array(z.number().int().positive()).optional(),
    scope: z.enum(["pierce", "district"]).default("pierce"),
  }),
  transform: z.record(z.string(), z.any()),
});

export const POST = withAdmin(async (request: NextRequest, session) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const transform = parsed.data.transform as unknown as BulkEditTransform;
  const transformErrs = validateTransform(transform);
  if (transformErrs.length > 0) {
    return NextResponse.json({ errors: transformErrs }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("products")
    .select("sku, description, barcode, retail_price, cost, vendor_id, dcc_id, item_tax_type_id, item_type, discontinued");

  const sel = parsed.data.selection as { skus?: number[]; filter?: Record<string, unknown> };
  if (sel.skus && sel.skus.length > 0) {
    query = query.in("sku", sel.skus);
  } else if (sel.filter) {
    const f = sel.filter as Record<string, unknown>;
    if (typeof f.q === "string") query = query.ilike("description", `%${f.q}%`);
    if (typeof f.vendorId === "number") query = query.eq("vendor_id", f.vendorId);
    if (typeof f.dccId === "number") query = query.eq("dcc_id", f.dccId);
    if (typeof f.itemType === "string") query = query.eq("item_type", f.itemType);
    if (typeof f.minRetail === "number") query = query.gte("retail_price", f.minRetail);
    if (typeof f.maxRetail === "number") query = query.lte("retail_price", f.maxRetail);
    if (typeof f.hasBarcode === "boolean") {
      query = f.hasBarcode ? query.not("barcode", "is", null) : query.is("barcode", null);
    }
  }
  query = query.limit(2000);

  const { data, error } = await query;
  if (error) {
    console.error("commit: supabase select failed:", error);
    return NextResponse.json({ error: "Failed to load selection" }, { status: 500 });
  }

  const sourceRows: BulkEditSourceRow[] = (data ?? []).map((r) => ({
    sku: r.sku,
    description: r.description ?? "",
    barcode: r.barcode ?? null,
    retail: Number(r.retail_price ?? 0),
    cost: Number(r.cost ?? 0),
    vendorId: r.vendor_id ?? null,
    dccId: r.dcc_id ?? null,
    itemTaxTypeId: r.item_tax_type_id ?? null,
    itemType: (r.item_type === "textbook" || r.item_type === "general_merchandise") ? r.item_type : null,
    fDiscontinue: r.discontinued ? 1 : 0,
  }));

  if (sourceRows.length === 0) {
    return NextResponse.json({
      errors: [{ code: "EMPTY_SELECTION", message: "Selection resolved to zero items." }],
    }, { status: 400 });
  }

  const preview = buildPreview(sourceRows, transform);

  const batchRows = preview.rows
    .filter((r) => r.changedFields.length > 0)
    .map((r) => {
      const patch: Record<string, unknown> = {};
      if (r.changedFields.includes("retail")) patch.retail = r.after.retail;
      if (r.changedFields.includes("cost")) patch.cost = r.after.cost;
      if (r.changedFields.includes("dccId") && r.after.dccId !== null) patch.dccId = r.after.dccId;
      if (r.changedFields.includes("itemTaxTypeId") && r.after.itemTaxTypeId !== null) {
        patch.itemTaxTypeId = r.after.itemTaxTypeId;
      }
      return { sku: r.sku, patch, isTextbook: false };
    });

  if (batchRows.length === 0) {
    return NextResponse.json({
      errors: [{ code: "NO_OP_TRANSFORM", message: "Every selected row would be unchanged — nothing to commit." }],
    }, { status: 400 });
  }

  // Call the existing batch endpoint in-process. The imported POST is
  // withAdmin-wrapped; the reconstructed NextRequest carries the original
  // request's cookies so the nested auth check passes.
  const { POST: batchHandler } = await import("../../batch/route");
  const batchReq = new NextRequest(new URL(request.url).origin + "/api/products/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify({ action: "update", rows: batchRows }),
  });
  const batchRes = await batchHandler(batchReq);
  const batchJson = await batchRes.json().catch(() => null);

  if (!batchRes.ok) {
    console.error("commit: batch rejected", batchJson);
    return NextResponse.json(batchJson ?? { error: "Batch commit failed" }, { status: batchRes.status });
  }

  const summary = `${preview.totals.rowCount} items — retail delta $${(preview.totals.pricingDeltaCents / 100).toFixed(2)}${preview.totals.districtChangeCount > 0 ? `, ${preview.totals.districtChangeCount} district changes` : ""}`;

  const run = await prisma.bulkEditRun.create({
    data: {
      operatorUserId: session.user.id,
      operatorDisplay: session.user.name ?? session.user.username ?? "unknown",
      selection: parsed.data.selection as never,
      transform: transform as never,
      affectedSkus: batchRows.map((r) => r.sku),
      skuCount: batchRows.length,
      pricingDeltaCents: BigInt(preview.totals.pricingDeltaCents),
      hadDistrictChanges: preview.totals.districtChangeCount > 0,
      summary,
    },
  });

  return NextResponse.json({
    runId: run.id,
    successCount: batchRows.length,
    affectedSkus: batchRows.map((r) => r.sku),
  });
});
