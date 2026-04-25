import { type NextRequest } from "next/server";
import { analyticsCache } from "@/domains/analytics/cache";
import { withAuth } from "@/domains/shared/auth";
import { analyticsJson, parseAnalyticsFilters } from "../route-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const parsed = parseAnalyticsFilters(req);
  if ("response" in parsed) return parsed.response;

  const result = await analyticsCache.getFinance(parsed.filters);
  return analyticsJson(result);
});
