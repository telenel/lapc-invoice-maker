import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = rawId.trim();
  if (!id) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const quote = await quoteService.getById(id);
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    const { buffer, filename } = await quoteService.generatePdf(id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}.pdf"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    console.error("GET /api/quotes/[id]/pdf failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
