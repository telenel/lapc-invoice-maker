import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { getDashboardStatsData } from "@/domains/dashboard/service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  const stats = await getDashboardStatsData();
  return NextResponse.json(stats);
});
