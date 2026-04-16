import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { createGmItem } from "@/domains/product/prism-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const createItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(128),
  vendorId: z.coerce.number().int().positive(),
  dccId: z.coerce.number().int().positive(),
  mfgId: z.coerce.number().int().positive().optional(),
  itemTaxTypeId: z.coerce.number().int().positive().optional(),
  barcode: z.string().max(20).optional().nullable(),
  catalogNumber: z.string().max(30).optional().nullable(),
  comment: z.string().max(25).optional().nullable(),
  weight: z.coerce.number().nonnegative().optional(),
  imageUrl: z.string().max(128).optional().nullable(),
  unitsPerPack: z.coerce.number().int().positive().optional(),
  packageType: z.string().max(3).optional().nullable(),
  retail: z.coerce.number().nonnegative(),
  cost: z.coerce.number().nonnegative(),
});

/**
 * Create a new General Merchandise item in Prism, then mirror it into the
 * Supabase `products` table for immediate visibility in the read-only catalog.
 *
 * Requires admin role. Requires Prism reachability (returns 503 if not).
 */
export const POST = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await createGmItem(parsed.data);

    // Mirror into Supabase products table. Failure here doesn't fail the request
    // because the source-of-truth write to Prism has already succeeded — the
    // nightly sync will repair any drift.
    try {
      const supabase = getSupabaseAdminClient();
      const { error: mirrorError } = await supabase
        .from("products")
        .upsert({
          sku: created.sku,
          item_type: "general_merchandise",
          description: created.description,
          barcode: created.barcode,
          retail_price: created.retail,
          cost: created.cost,
          vendor_id: created.vendorId,
          dcc_id: created.dccId,
          synced_at: new Date().toISOString(),
        });
      if (mirrorError) {
        console.warn("[POST /api/products] mirror failed:", mirrorError);
      }
    } catch (mirrorErr) {
      console.warn("[POST /api/products] mirror threw:", mirrorErr);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/products failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
