import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { analyticsService } from "@/domains/analytics/service";

export const GET = withAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const result = await analyticsService.getAnalytics({ dateFrom, dateTo });
  return NextResponse.json(result);
});
