import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  jobRun: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma,
}));

describe("job runs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.JOB_SCHEDULER;
    delete process.env.SUPABASE_SCHEDULER_CONFIRMED;
  });

  it("records successful tracked jobs", async () => {
    prisma.jobRun.create.mockResolvedValue({ id: "run-1" });
    prisma.jobRun.update.mockResolvedValue({ id: "run-1" });

    const { runTrackedJob } = await import("@/lib/job-runs");
    const result = await runTrackedJob("event-reminders", { runner: "node-cron" }, async () => "ok");

    expect(result).toBe("ok");
    expect(prisma.jobRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobKey: "event-reminders",
          runner: "node-cron",
          status: "running",
        }),
      }),
    );
    expect(prisma.jobRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "success",
        }),
      }),
    );
  });

  it("summarizes recent job runs", async () => {
    prisma.jobRun.findMany.mockResolvedValue([
      {
        id: "run-1",
        jobKey: "event-reminders",
        schedulerMode: "app",
        runner: "node-cron",
        status: "success",
        startedAt: new Date("2026-04-04T10:00:00.000Z"),
        finishedAt: new Date("2026-04-04T10:00:01.000Z"),
        durationMs: 1000,
        details: null,
      },
    ]);

    const { getJobRunHealth } = await import("@/lib/job-runs");
    const result = await getJobRunHealth();

    expect(result.summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jobKey: "event-reminders",
          lastStatus: "success",
          lastRunner: "node-cron",
        }),
      ]),
    );
    expect(result.recentRuns).toHaveLength(1);
  });
});
