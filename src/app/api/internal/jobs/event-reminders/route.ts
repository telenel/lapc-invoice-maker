import { NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import { checkAndSendReminders } from "@/domains/event/reminders";
import { runTrackedJob } from "@/lib/job-runs";

export const runtime = "nodejs";

export const POST = withCronAuth(async () => {
  await runTrackedJob("event-reminders", { runner: "internal-api" }, () => checkAndSendReminders());

  return NextResponse.json({
    ok: true,
    job: "event-reminders",
  });
});
