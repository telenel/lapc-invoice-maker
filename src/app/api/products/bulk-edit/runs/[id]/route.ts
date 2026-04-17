import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAdmin(async (_request: NextRequest, _session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const run = await prisma.bulkEditRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...run,
    pricingDeltaCents: Number(run.pricingDeltaCents),
  });
});
