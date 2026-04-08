import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveJobSchedulerMode, getJobSchedulerMode } from "@/lib/job-scheduler";

export const KNOWN_JOB_KEYS = ["event-reminders", "payment-follow-ups", "account-follow-ups"] as const;

type KnownJobKey = typeof KNOWN_JOB_KEYS[number];

export type JobRunStatus = "running" | "success" | "failure";

export type RecentJobRun = {
  id: string;
  jobKey: string;
  schedulerMode: string;
  runner: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  details: unknown;
};

export type JobHealthSummary = {
  jobKey: KnownJobKey;
  activeSchedulerMode: "app" | "supabase";
  configuredSchedulerMode: "app" | "supabase";
  lastStatus: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastDurationMs: number | null;
  lastRunner: string | null;
};

function normalizeErrorDetails(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return { message: String(error) };
}

function toJsonDetails(details?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!details || Object.keys(details).length === 0) {
    return undefined;
  }

  return details as Prisma.InputJsonValue;
}

export async function runTrackedJob<T>(
  jobKey: KnownJobKey,
  options: {
    runner?: string;
    details?: Record<string, unknown>;
  } = {},
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  const run = await prisma.jobRun.create({
    data: {
      jobKey,
      schedulerMode: getActiveJobSchedulerMode(),
      runner: options.runner ?? null,
      status: "running",
      details: toJsonDetails(options.details),
    },
  });

  try {
    const result = await fn();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      },
    });
    return result;
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: "failure",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        details: toJsonDetails({
          ...(options.details ?? {}),
          error: normalizeErrorDetails(error),
        }),
      },
    }).catch(() => {});
    throw error;
  }
}

export async function getJobRunHealth(): Promise<{
  summaries: JobHealthSummary[];
  recentRuns: RecentJobRun[];
}> {
  const recentRuns = await prisma.jobRun.findMany({
    where: { jobKey: { in: [...KNOWN_JOB_KEYS] } },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  const summaries = KNOWN_JOB_KEYS.map((jobKey) => {
    const latest = recentRuns.find((run) => run.jobKey === jobKey) ?? null;
    return {
      jobKey,
      activeSchedulerMode: getActiveJobSchedulerMode(),
      configuredSchedulerMode: getJobSchedulerMode(),
      lastStatus: latest?.status ?? null,
      lastStartedAt: latest?.startedAt.toISOString() ?? null,
      lastFinishedAt: latest?.finishedAt?.toISOString() ?? null,
      lastDurationMs: latest?.durationMs ?? null,
      lastRunner: latest?.runner ?? null,
    };
  });

  return {
    summaries,
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      jobKey: run.jobKey,
      schedulerMode: run.schedulerMode,
      runner: run.runner,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      details: run.details,
    })),
  };
}
