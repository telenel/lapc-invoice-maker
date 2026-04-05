import { NextResponse, type NextRequest } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import {
  getSupabaseSchedulerStatus,
  reconcileSupabaseScheduler,
} from "@/lib/supabase-scheduler";
import { getJobSchedulerMode, getCronSecret } from "@/lib/job-scheduler";

export const runtime = "nodejs";

function getAppUrl(req: NextRequest): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured && /^https?:\/\//.test(configured) && !configured.includes("localhost")) {
    return configured;
  }

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return req.nextUrl.origin;
}

export const GET = withCronAuth(async () => {
  try {
    const status = await getSupabaseSchedulerStatus();
    return NextResponse.json({
      mode: getJobSchedulerMode(),
      status,
    });
  } catch (error) {
    console.error("GET /api/internal/platform/supabase-scheduler failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Scheduler status unavailable",
      },
      { status: 500 },
    );
  }
});

export const POST = withCronAuth(async (req) => {
  if (getJobSchedulerMode() !== "supabase") {
    return NextResponse.json(
      { error: "JOB_SCHEDULER is not set to supabase" },
      { status: 409 },
    );
  }

  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  try {
    const status = await reconcileSupabaseScheduler({
      appUrl: getAppUrl(req),
      cronSecret,
    });

    return NextResponse.json({
      ok: true,
      mode: getJobSchedulerMode(),
      status,
    });
  } catch (error) {
    console.error("POST /api/internal/platform/supabase-scheduler failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Scheduler reconciliation failed",
      },
      { status: 500 },
    );
  }
});
