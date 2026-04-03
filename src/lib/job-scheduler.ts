const DEFAULT_JOB_SCHEDULER = "app";

export function getJobSchedulerMode(): "app" | "supabase" {
  return process.env.JOB_SCHEDULER === "supabase"
    ? "supabase"
    : DEFAULT_JOB_SCHEDULER;
}

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}
