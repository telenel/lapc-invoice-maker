import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { followUpService } from "@/domains/follow-up/service";

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.invoiceIds) || body.invoiceIds.length === 0) {
    return NextResponse.json(
      { error: "invoiceIds array is required" },
      { status: 400 },
    );
  }

  if (body.invoiceIds.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 items per request" },
      { status: 400 },
    );
  }

  const result = await followUpService.initiateMultiple(
    body.invoiceIds,
    session.user.id,
    session.user.role === "admin",
  );

  return NextResponse.json(result);
});
