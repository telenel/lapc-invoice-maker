import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { templateService } from "@/domains/template/service";

export const GET = withAuth(async (req: NextRequest, session) => {
  try {
    const rawType = req.nextUrl.searchParams.get("type");
    const type = rawType === "INVOICE" || rawType === "QUOTE" ? rawType : undefined;
    const templates = await templateService.list(session.user.id, type);
    return NextResponse.json(templates);
  } catch (err) {
    console.error("GET /api/templates failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, session) => {
  try {
    const body = await req.json();
    const template = await templateService.create(body, session.user.id);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    console.error("POST /api/templates failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
