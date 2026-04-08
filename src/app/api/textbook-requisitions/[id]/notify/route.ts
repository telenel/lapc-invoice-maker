import { NextRequest, NextResponse } from "next/server";
import { forbiddenResponse, withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";

export const POST = withAuth(async (req: NextRequest, session, ctx) => {
  const rawId = (ctx && ctx.params ? (await ctx.params).id : "").trim();
  if (!rawId) {
    return NextResponse.json({ error: "Invalid requisition id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const emailType = typeof body.emailType === "string" ? body.emailType : "";

  if (!["ordered", "on-shelf"].includes(emailType)) {
    return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
  }

  try {
    const existing = await requisitionService.getById(rawId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (session.user.role !== "admin" && existing.createdBy !== session.user.id) {
      return forbiddenResponse();
    }
    const result = await requisitionService.sendNotification(rawId, emailType, session.user.id);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // 200 for success or email failure (recorded). emailSent tells the UI what happened.
    // "in_progress" from concurrent request gets a distinct error message for the toast.
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
