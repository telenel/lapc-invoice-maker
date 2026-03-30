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
    const body = await req.json();
    const pricing = await printPricingService.updatePricingConfig(body);
    return NextResponse.json(pricing);
  } catch (error) {
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
