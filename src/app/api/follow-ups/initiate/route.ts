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

  const invoiceIds = body.invoiceIds
    .map((id: unknown) => (typeof id === "string" ? id.trim() : ""))
    .filter((id: string) => id.length > 0);

  if (invoiceIds.length !== body.invoiceIds.length) {
    return NextResponse.json(
      { error: "invoiceIds must contain valid IDs" },
      { status: 400 },
    );
  }

  if (invoiceIds.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 items per request" },
      { status: 400 },
    );
  }

  try {
    const result = await followUpService.initiateMultiple(
      invoiceIds,
      session.user.id,
      session.user.role === "admin",
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/follow-ups/initiate failed:", error);
    return NextResponse.json(
      { error: "Failed to initiate follow-up requests" },
      { status: 500 },
    );
  }
});
