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
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (body.type !== "INVOICE" && body.type !== "QUOTE") {
      return NextResponse.json({ error: "type must be INVOICE or QUOTE" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
    }
    const template = await templateService.create(body, session.user.id);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    console.error("POST /api/templates failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
