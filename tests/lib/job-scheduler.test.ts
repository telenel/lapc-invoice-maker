import { describe, expect, it } from "vitest";
import {
  getActiveJobSchedulerMode,
  getCronSecret,
  getJobSchedulerMode,
  isSupabaseSchedulerConfirmed,
} from "@/lib/job-scheduler";

describe("job scheduler config", () => {
  it("defaults to app scheduler", () => {
    delete process.env.JOB_SCHEDULER;

    expect(getJobSchedulerMode()).toBe("app");
  });

  it("returns supabase scheduler when configured", () => {
    process.env.JOB_SCHEDULER = "supabase";

    expect(getJobSchedulerMode()).toBe("supabase");
  });

  it("keeps app as the active scheduler until Supabase is confirmed", () => {
    process.env.JOB_SCHEDULER = "supabase";
    delete process.env.SUPABASE_SCHEDULER_CONFIRMED;

    expect(getActiveJobSchedulerMode()).toBe("app");
  });

  it("normalizes empty cron secrets to null", () => {
    process.env.CRON_SECRET = "   ";

    expect(getCronSecret()).toBeNull();
  });

  it("requires an explicit confirmation flag for Supabase scheduler", () => {
    process.env.JOB_SCHEDULER = "supabase";
    process.env.SUPABASE_SCHEDULER_CONFIRMED = "true";

    expect(isSupabaseSchedulerConfirmed()).toBe(true);
    expect(getActiveJobSchedulerMode()).toBe("supabase");
  });
});
