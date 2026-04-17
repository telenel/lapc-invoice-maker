import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import {
  validateBatchCreateAgainstPrism,
  validateBatchUpdateAgainstPrism,
} from "@/domains/product/prism-batch";
import { hasTransactionHistory } from "@/domains/product/prism-delete";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    rows: z.array(z.object({
      description: z.string(),
      vendorId: z.number().int(),
      dccId: z.number().int(),
      itemTaxTypeId: z.number().int().optional(),
      barcode: z.string().nullable().optional(),
      catalogNumber: z.string().nullable().optional(),
      comment: z.string().nullable().optional(),
      packageType: z.string().nullable().optional(),
      unitsPerPack: z.number().int().optional(),
      retail: z.number(),
      cost: z.number(),
    })),
  }),
  z.object({
    action: z.literal("update"),
    rows: z.array(z.object({
      sku: z.number().int().positive(),
      patch: z.record(z.any()),
    })),
  }),
  z.object({
    action: z.literal("hard-delete"),
    skus: z.array(z.number().int().positive()),
  }),
]);

export const POST = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    if (parsed.data.action === "create") {
      const errors = await validateBatchCreateAgainstPrism(parsed.data.rows);
      return NextResponse.json({ errors });
    }
    if (parsed.data.action === "update") {
      const errors = await validateBatchUpdateAgainstPrism(parsed.data.rows);
      return NextResponse.json({ errors });
    }
    // hard-delete
    const hist = await hasTransactionHistory(parsed.data.skus);
    const errors = parsed.data.skus
      .map((sku, i) => hist.has(sku)
        ? { rowIndex: i, field: "sku", code: "HAS_HISTORY", message: `SKU ${sku} has transaction history` }
        : null)
      .filter((e) => e !== null);
    return NextResponse.json({ errors });
  } catch (err) {
    console.error("validate-batch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
