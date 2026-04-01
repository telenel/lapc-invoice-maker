export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production") return;

    const state = globalThis as typeof globalThis & {
      __laportalCronRegistered?: boolean;
    };
    if (state.__laportalCronRegistered) return;

    const cron = await import("node-cron");
    const { checkAndSendReminders } = await import("@/domains/event/reminders");
    const { checkAndSendPaymentFollowUps } = await import("@/domains/quote/follow-ups");

    // Event reminders — every 15 minutes
    cron.schedule("*/15 * * * *", () => {
      checkAndSendReminders().catch((err) =>
        console.error("[cron] event reminders failed:", err)
      );
    });

    // Payment follow-ups — daily at 9 AM Los Angeles time, weekdays only
    cron.schedule(
      "0 9 * * 1-5",
      () => {
        checkAndSendPaymentFollowUps().catch((err) =>
          console.error("[cron] payment follow-ups failed:", err)
        );
      },
      { timezone: "America/Los_Angeles" },
    );

    state.__laportalCronRegistered = true;
    console.log("[instrumentation] cron jobs registered");
  }
}
