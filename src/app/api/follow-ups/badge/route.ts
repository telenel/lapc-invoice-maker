import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { followUpService } from "@/domains/follow-up/service";

function normalizeIds(value: string): string[] {
  const cleaned = value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

export const GET = withAuth(async (req: NextRequest) => {
  // Batch mode: ?invoiceIds=id1,id2,id3
  const invoiceIdsParam = req.nextUrl.searchParams.get("invoiceIds");
  if (invoiceIdsParam !== null) {
    const ids = normalizeIds(invoiceIdsParam).slice(0, 100);

    if (ids.length === 0) {
      return NextResponse.json({ error: "invoiceIds cannot be empty" }, { status: 400 });
    }

    const badges = await followUpService.getBadgeStatesForInvoices(ids);
    return NextResponse.json(badges);
  }

  // Single mode: ?invoiceId=id
  const invoiceId = req.nextUrl.searchParams.get("invoiceId");
  const normalizedInvoiceId = invoiceId?.trim();
  if (!normalizedInvoiceId) {
    return NextResponse.json(
      { error: "invoiceId or invoiceIds required" },
      { status: 400 },
    );
  }

  const state = await followUpService.getBadgeState(normalizedInvoiceId);
  if (!state) {
    return NextResponse.json(null);
  }

  return NextResponse.json(state);
});
