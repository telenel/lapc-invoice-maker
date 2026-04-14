import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { archiveService } from "@/domains/archive/service";

const VALID_TYPES = new Set(["INVOICE", "QUOTE", "all"]);

function parsePositiveInt(value: string | null, fallback: number): number | "error" {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return "error";
  return parsed;
}

export const GET = withAuth(async (req: NextRequest, session) => {
  try {
    const sp = req.nextUrl.searchParams;
    const rawType = sp.get("type");
    if (rawType && !VALID_TYPES.has(rawType)) {
      return NextResponse.json({ error: "Invalid archive type" }, { status: 400 });
    }

    const page = parsePositiveInt(sp.get("page"), 1);
    if (page === "error") {
      return NextResponse.json({ error: "Invalid page value" }, { status: 400 });
    }

    const pageSize = parsePositiveInt(sp.get("pageSize"), 20);
    if (pageSize === "error") {
      return NextResponse.json({ error: "Invalid pageSize value" }, { status: 400 });
    }

    const filters = {
      ...(rawType ? { type: rawType as "INVOICE" | "QUOTE" | "all" } : {}),
      ...(sp.get("search")?.trim() ? { search: sp.get("search")!.trim() } : {}),
      page,
      pageSize,
    };

    return NextResponse.json(
      await archiveService.list(filters, session.user.id, session.user.role === "admin"),
    );
  } catch (err) {
    console.error("GET /api/archive failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
