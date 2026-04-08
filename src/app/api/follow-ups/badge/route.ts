import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { followUpService } from "@/domains/follow-up/service";

export const GET = withAuth(async (req: NextRequest) => {
  // Batch mode: ?invoiceIds=id1,id2,id3
  const invoiceIdsParam = req.nextUrl.searchParams.get("invoiceIds");
  if (invoiceIdsParam) {
    const ids = invoiceIdsParam.split(",").filter(Boolean).slice(0, 100);
    const badges = await followUpService.getBadgeStatesForInvoices(ids);
    return NextResponse.json(badges);
  }

  // Single mode: ?invoiceId=id
  const invoiceId = req.nextUrl.searchParams.get("invoiceId");
  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoiceId or invoiceIds required" },
      { status: 400 },
    );
  }

  const state = await followUpService.getBadgeState(invoiceId);
  if (!state) {
    return NextResponse.json(null);
  }

  return NextResponse.json(state);
});
