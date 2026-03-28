import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";
import { quoteCreateSchema } from "@/lib/validators";
import { Prisma } from "@/generated/prisma/client";

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;

    const filters = {
      search: sp.get("search") ?? undefined,
      quoteStatus: (sp.get("quoteStatus") ?? undefined) as
        | "DRAFT"
        | "SENT"
        | "ACCEPTED"
        | "DECLINED"
        | "EXPIRED"
        | "all"
        | undefined,
      department: sp.get("department") ?? undefined,
      category: sp.get("category") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      page: Math.max(1, parseInt(sp.get("page") ?? "1", 10)),
      pageSize: Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10)),
      sortBy: sp.get("sortBy") ?? "createdAt",
      sortOrder: (sp.get("sortDir") ?? "desc") as "asc" | "desc",
    };

    return NextResponse.json(await quoteService.list(filters));
  } catch (err) {
    console.error("GET /api/quotes failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json();
  const parsed = quoteCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const quote = await quoteService.create(parsed.data, session.user.id);
    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A quote with this number already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/quotes failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
