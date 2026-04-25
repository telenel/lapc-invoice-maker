import { type NextRequest, NextResponse } from "next/server";
import type { AnalyticsFilters } from "@/domains/analytics/types";

function isValidDateString(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export function parseAnalyticsFilters(req: NextRequest):
  | { filters: AnalyticsFilters }
  | { response: NextResponse } {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  if (dateFrom !== undefined && !isValidDateString(dateFrom)) {
    return { response: NextResponse.json({ error: "Invalid dateFrom value" }, { status: 400 }) };
  }
  if (dateTo !== undefined && !isValidDateString(dateTo)) {
    return { response: NextResponse.json({ error: "Invalid dateTo value" }, { status: 400 }) };
  }

  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    return {
      response: NextResponse.json(
        { error: "dateFrom must be less than or equal to dateTo" },
        { status: 400 },
      ),
    };
  }

  return { filters: { dateFrom, dateTo } };
}

export function analyticsJson<T>(data: T) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
