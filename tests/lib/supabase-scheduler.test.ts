import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawUnsafe = vi.fn();
const executeRawUnsafe = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafe,
    $executeRawUnsafe: executeRawUnsafe,
  },
}));

describe("supabase scheduler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reports extension and expected job presence", async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ extname: "pg_cron" }, { extname: "pg_net" }])
      .mockResolvedValueOnce([
        { jobid: 1n, jobname: "laportal-event-reminders", schedule: "*/15 * * * *", active: true },
      ]);

    const { getSupabaseSchedulerStatus } = await import("@/lib/supabase-scheduler");
    const status = await getSupabaseSchedulerStatus();

    expect(status.extensions).toEqual({ pgCron: true, pgNet: true });
    expect(status.jobs).toEqual([
      {
        jobid: "1",
        jobname: "laportal-event-reminders",
        schedule: "*/15 * * * *",
        active: true,
      },
    ]);
    expect(status.expectedJobs).toEqual({
      eventReminders: true,
      paymentFollowUps: false,
    });
  });

  it("creates missing jobs during reconciliation", async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ extname: "pg_cron" }, { extname: "pg_net" }])
      .mockResolvedValueOnce([
        { jobid: 1, jobname: "laportal-event-reminders", schedule: "*/15 * * * *", active: true },
        { jobid: 2, jobname: "laportal-payment-follow-ups", schedule: "0 16 * * 1-5", active: true },
      ]);

    const { reconcileSupabaseScheduler } = await import("@/lib/supabase-scheduler");
    const status = await reconcileSupabaseScheduler({
      appUrl: "https://laportal.montalvo.io",
      cronSecret: "secret",
    });

    expect(executeRawUnsafe).toHaveBeenCalledWith("create extension if not exists pg_cron");
    expect(executeRawUnsafe).toHaveBeenCalledWith("create extension if not exists pg_net");
    expect(executeRawUnsafe).toHaveBeenCalledTimes(4);
    expect(status.expectedJobs).toEqual({
      eventReminders: true,
      paymentFollowUps: true,
    });
  });
});
