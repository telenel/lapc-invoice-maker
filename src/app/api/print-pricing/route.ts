import { NextResponse } from "next/server";
import { printPricingService } from "@/domains/print-pricing/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const pricing = await printPricingService.getPricingSnapshot();
  return NextResponse.json(pricing);
}
