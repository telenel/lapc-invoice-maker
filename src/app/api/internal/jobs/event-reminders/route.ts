import { NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import { checkAndSendReminders } from "@/domains/event/reminders";

export const runtime = "nodejs";

export const POST = withCronAuth(async () => {
  await checkAndSendReminders();

  return NextResponse.json({
    ok: true,
    job: "event-reminders",
  });
});
