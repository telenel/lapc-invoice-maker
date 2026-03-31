export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");
    const { checkAndSendReminders } = await import("@/domains/event/reminders");
    const { checkAndSendPaymentFollowUps } = await import("@/domains/quote/follow-ups");

    // Event reminders — every 15 minutes
    cron.schedule("*/15 * * * *", () => {
      checkAndSendReminders().catch((err) =>
        console.error("[cron] event reminders failed:", err)
      );
    });

    // Payment follow-ups — daily at 9 AM PT (16:00 UTC), weekdays only
    cron.schedule("0 16 * * 1-5", () => {
      checkAndSendPaymentFollowUps().catch((err) =>
        console.error("[cron] payment follow-ups failed:", err)
      );
    });

    console.log("[instrumentation] cron jobs registered");
  }
}
