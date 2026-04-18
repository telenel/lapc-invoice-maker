import { NextRequest, NextResponse } from "next/server";
import { isPrismConfigured } from "@/lib/prism";
import { prisma } from "@/lib/prisma";
import { runPrismPull } from "@/domains/product/prism-sync";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — allow full catalog pulls

/**
 * Handles both authenticated admin invocations (session cookie) and
 * scheduled cron invocations (X-Internal-Cron-Secret header matching
 * CRON_INTERNAL_SECRET env var). Cron path bypasses session auth; admin
 * path requires role=admin. Either path records a sync_runs row.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const cronSecret = request.headers.get("x-internal-cron-secret");
  const expectedSecret = process.env.CRON_INTERNAL_SECRET;
  const isCron = !!(cronSecret && expectedSecret && cronSecret === expectedSecret);

  let triggeredBy: string;
  if (isCron) {
    triggeredBy = "scheduled";
  } else {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
    triggeredBy = `manual:${(session.user as { id: string }).id}`;
  }

  const run = await prisma.syncRun.create({
    data: {
      triggeredBy,
      status: "running",
    },
  });

  try {
    const result = await runPrismPull();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        scannedCount: result.scanned,
        updatedCount: result.updated,
        removedCount: result.removed,
        status: "ok",
      },
    });
    return NextResponse.json({ runId: run.id, ...result });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    console.error("prism-pull failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }
  const runs = await prisma.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ runs });
}
