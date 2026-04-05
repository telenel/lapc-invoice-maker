import { NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import { checkAndSendPaymentFollowUps } from "@/domains/quote/follow-ups";
import { runTrackedJob } from "@/lib/job-runs";

export const runtime = "nodejs";

export const POST = withCronAuth(async () => {
  await runTrackedJob("payment-follow-ups", { runner: "internal-api" }, () =>
    checkAndSendPaymentFollowUps()
  );

  return NextResponse.json({
    ok: true,
    job: "payment-follow-ups",
  });
});
