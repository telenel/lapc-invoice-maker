export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production") return;

    const {
      getActiveJobSchedulerMode,
      getJobSchedulerMode,
    } = await import("@/lib/job-scheduler");
    if (getActiveJobSchedulerMode() === "supabase") {
      console.log("[instrumentation] skipping app cron registration; confirmed Supabase scheduler is active");
      return;
    }

    const state = globalThis as typeof globalThis & {
      __laportalCronRegistered?: boolean;
    };
    if (state.__laportalCronRegistered) return;

    const cron = await import("node-cron");
    const { checkAndSendReminders } = await import("@/domains/event/reminders");
    const { checkAndSendPaymentFollowUps } = await import("@/domains/quote/follow-ups");
    const { checkAndSendAccountFollowUps } = await import("@/domains/follow-up/account-follow-ups");
    const { runTrackedJob } = await import("@/lib/job-runs");

    // Event reminders — every 15 minutes
    cron.schedule("*/15 * * * *", () => {
      runTrackedJob("event-reminders", { runner: "node-cron" }, () => checkAndSendReminders()).catch((err) =>
        console.error("[cron] event reminders failed:", err)
      );
    });

    // Payment follow-ups — daily at 9 AM Los Angeles time, weekdays only
    cron.schedule(
      "0 9 * * 1-5",
      () => {
        runTrackedJob("payment-follow-ups", { runner: "node-cron" }, () => checkAndSendPaymentFollowUps()).catch((err) =>
          console.error("[cron] payment follow-ups failed:", err)
        );
      },
      { timezone: "America/Los_Angeles" },
    );

    // Account follow-ups — Mondays at 9 AM Los Angeles time
    cron.schedule(
      "0 9 * * 1",
      () => {
        runTrackedJob("account-follow-ups", { runner: "node-cron" }, () => checkAndSendAccountFollowUps()).catch((err) =>
          console.error("[cron] account follow-ups failed:", err)
        );
      },
      { timezone: "America/Los_Angeles" },
    );

    state.__laportalCronRegistered = true;
    if (getJobSchedulerMode() === "supabase") {
      console.warn("[instrumentation] JOB_SCHEDULER=supabase but scheduler is not confirmed; keeping app cron active");
    } else {
      console.log("[instrumentation] cron jobs registered");
    }
  }
}
