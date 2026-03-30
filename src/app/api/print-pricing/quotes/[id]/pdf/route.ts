import { NextResponse } from "next/server";
import { printPricingService } from "@/domains/print-pricing/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const { buffer, quoteNumber } = await printPricingService.getQuotePdfBuffer(id);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quoteNumber}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Quote PDF not found" }, { status: 404 });
  }
}
