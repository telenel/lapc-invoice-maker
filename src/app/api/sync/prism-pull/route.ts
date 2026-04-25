import { NextRequest, NextResponse } from "next/server";
import { isPrismConfigured } from "@/lib/prism";
import { prisma } from "@/lib/prisma";
import { runPrismPull } from "@/domains/product/prism-sync";
import { analyticsCache } from "@/domains/analytics/cache";
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

    // Incremental transaction history + aggregate recompute. Isolated from
    // the catalog step's success/failure — but the run is marked partial so
    // operators can see when analytics are stale or skipped.
    let txnResult: { txnsAdded: number; aggregatesUpdated: number; durationMs: number; skipped?: string } = {
      txnsAdded: 0,
      aggregatesUpdated: 0,
      durationMs: 0,
    };
    let status: "ok" | "partial" = "ok";
    let txnSyncError: string | null = null;
    try {
      const { getPrismPool } = await import("@/lib/prism");
      const { runSalesTxnSync } = await import("@/domains/product/sales-txn-sync");
      const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const pool = await getPrismPool();
      const supabase = getSupabaseAdminClient();
      txnResult = await runSalesTxnSync({ supabase, prism: pool });
      if (txnResult.skipped) {
        status = "partial";
        txnSyncError = `Transaction sync skipped: ${txnResult.skipped}`;
      }
    } catch (txnErr) {
      status = "partial";
      txnSyncError = txnErr instanceof Error ? txnErr.message : String(txnErr);
      console.error("sales-txn-sync failed:", txnErr);
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        scannedCount: result.scanned,
        updatedCount: result.updated,
        removedCount: result.removed,
        txnsAdded: txnResult.txnsAdded,
        aggregatesUpdated: txnResult.aggregatesUpdated,
        txnSyncDurationMs: txnResult.durationMs,
        status,
        error: txnSyncError,
      },
    });
    analyticsCache.clear();
    return NextResponse.json({
      runId: run.id,
      status,
      ...result,
      txnsAdded: txnResult.txnsAdded,
      aggregatesUpdated: txnResult.aggregatesUpdated,
      txnSyncDurationMs: txnResult.durationMs,
      txnSyncSkipped: txnResult.skipped,
      txnSyncError,
    });
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
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      triggeredBy: true,
      scannedCount: true,
      updatedCount: true,
      removedCount: true,
      txnsAdded: true,
      aggregatesUpdated: true,
      txnSyncDurationMs: true,
      status: true,
      error: true,
    },
  });
  return NextResponse.json({ runs });
}
