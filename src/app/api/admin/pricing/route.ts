import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { printPricingService } from "@/domains/print-pricing/service";

export const GET = withAdmin(async () => {
  const pricing = await printPricingService.getPricingSnapshot();
  return NextResponse.json(pricing);
});

export const PUT = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => {
      throw new SyntaxError("INVALID_JSON");
    });
    const pricing = await printPricingService.updatePricingConfig(body);
    return NextResponse.json(pricing);
  } catch (error) {
    if (error instanceof SyntaxError && error.message === "INVALID_JSON") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid pricing configuration" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save pricing configuration" },
      { status: 500 }
    );
  }
});
