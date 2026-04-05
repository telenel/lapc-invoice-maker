import { describe, expect, it } from "vitest";
import { getCronSecret, getJobSchedulerMode } from "@/lib/job-scheduler";

describe("job scheduler config", () => {
  it("defaults to app scheduler", () => {
    delete process.env.JOB_SCHEDULER;

    expect(getJobSchedulerMode()).toBe("app");
  });

  it("returns supabase scheduler when configured", () => {
    process.env.JOB_SCHEDULER = "supabase";

    expect(getJobSchedulerMode()).toBe("supabase");
  });

  it("normalizes empty cron secrets to null", () => {
    process.env.CRON_SECRET = "   ";

    expect(getCronSecret()).toBeNull();
  });
});
