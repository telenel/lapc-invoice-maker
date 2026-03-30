import { NextResponse } from "next/server";
import { printPricingService } from "@/domains/print-pricing/service";

export async function GET() {
  const pricing = await printPricingService.getPricingSnapshot();
  return NextResponse.json(pricing);
}
