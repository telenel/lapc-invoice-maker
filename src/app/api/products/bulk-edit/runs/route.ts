import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (request: NextRequest) => {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  const runs = await prisma.bulkEditRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      createdAt: true,
      operatorDisplay: true,
      skuCount: true,
      pricingDeltaCents: true,
      hadDistrictChanges: true,
      summary: true,
    },
  });

  const total = await prisma.bulkEditRun.count();

  return NextResponse.json({
    items: runs.map((r) => ({
      ...r,
      pricingDeltaCents: Number(r.pricingDeltaCents), // BigInt → number for JSON
    })),
    total,
    limit,
    offset,
  });
});
