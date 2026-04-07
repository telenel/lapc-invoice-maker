import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";

export const POST = withAuth(async (req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json();
  const emailType = body.emailType as "ordered" | "on-shelf";

  if (!["ordered", "on-shelf"].includes(emailType)) {
    return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
  }

  try {
    const result = await requisitionService.sendNotification(id, emailType, session.user.id);
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
