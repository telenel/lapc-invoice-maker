import { NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import { checkAndSendAccountFollowUps } from "@/domains/follow-up/account-follow-ups";
import { runTrackedJob } from "@/lib/job-runs";

export const runtime = "nodejs";

export const POST = withCronAuth(async () => {
  await runTrackedJob("account-follow-ups", { runner: "internal-api" }, () =>
    checkAndSendAccountFollowUps()
  );

  return NextResponse.json({
    ok: true,
    job: "account-follow-ups",
  });
});
