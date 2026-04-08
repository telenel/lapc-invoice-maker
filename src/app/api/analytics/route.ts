import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { analyticsService } from "@/domains/analytics/service";

function isValidDateString(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export const GET = withAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  if (dateFrom !== undefined && !isValidDateString(dateFrom)) {
    return NextResponse.json({ error: "Invalid dateFrom value" }, { status: 400 });
  }
  if (dateTo !== undefined && !isValidDateString(dateTo)) {
    return NextResponse.json({ error: "Invalid dateTo value" }, { status: 400 });
  }

  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    return NextResponse.json(
      { error: "dateFrom must be less than or equal to dateTo" },
      { status: 400 },
    );
  }

  const result = await analyticsService.getAnalytics({ dateFrom, dateTo });
  return NextResponse.json(result);
});
