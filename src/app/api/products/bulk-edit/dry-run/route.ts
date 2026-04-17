import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTransform } from "@/domains/bulk-edit/transform-engine";
import { buildPreview } from "@/domains/bulk-edit/preview-builder";
import type { BulkEditSourceRow, BulkEditTransform } from "@/domains/bulk-edit/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  selection: z.object({
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
  }),
  transform: z.record(z.string(), z.any()),
});

export const POST = withAdmin(async (request: NextRequest) => {
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

  const sel = parsed.data.selection;
  if (sel.skus && sel.skus.length > 0) {
    query = query.in("sku", sel.skus);
  } else if (sel.filter) {
    if (sel.filter.q) query = query.ilike("description", `%${sel.filter.q}%`);
    if (sel.filter.vendorId !== undefined) query = query.eq("vendor_id", sel.filter.vendorId);
    if (sel.filter.dccId !== undefined) query = query.eq("dcc_id", sel.filter.dccId);
    if (sel.filter.itemType) query = query.eq("item_type", sel.filter.itemType);
    if (sel.filter.minRetail !== undefined) query = query.gte("retail_price", sel.filter.minRetail);
    if (sel.filter.maxRetail !== undefined) query = query.lte("retail_price", sel.filter.maxRetail);
    if (sel.filter.hasBarcode !== undefined) {
      query = sel.filter.hasBarcode ? query.not("barcode", "is", null) : query.is("barcode", null);
    }
  }

  query = query.limit(2000);

  const { data, error } = await query;
  if (error) {
    console.error("dry-run: supabase select failed:", error);
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
  return NextResponse.json(preview);
});
