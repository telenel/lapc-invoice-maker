import { NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import { checkAndSendPaymentFollowUps } from "@/domains/quote/follow-ups";

export const runtime = "nodejs";

export const POST = withCronAuth(async () => {
  await checkAndSendPaymentFollowUps();

  return NextResponse.json({
    ok: true,
    job: "payment-follow-ups",
  });
});
