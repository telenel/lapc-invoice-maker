import { prisma } from "@/lib/prisma";

type ExtensionRow = { extname: string };
type CronJobRow = { jobid: bigint | number | string; jobname: string; schedule: string; active: boolean };

const EVENT_REMINDERS_JOB = "laportal-event-reminders";
const PAYMENT_FOLLOW_UPS_JOB = "laportal-payment-follow-ups";
const ACCOUNT_FOLLOW_UPS_JOB = "laportal-account-follow-ups";

export type SupabaseSchedulerStatus = {
  extensions: {
    pgCron: boolean;
    pgNet: boolean;
  };
  jobs: Array<{
    jobid: string;
    jobname: string;
    schedule: string;
    active: boolean;
  }>;
  expectedJobs: {
    eventReminders: boolean;
    paymentFollowUps: boolean;
    accountFollowUps: boolean;
  };
};

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function buildCronCommand(pathname: string, appUrl: string, cronSecret: string): string {
  const normalizedBase = appUrl.replace(/\/+$/, "");
  const url = `${normalizedBase}${pathname}`;
  const escapedUrl = escapeSqlLiteral(url);
  const escapedSecret = escapeSqlLiteral(cronSecret);

  return `
    select net.http_post(
      url := '${escapedUrl}',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ${escapedSecret}'
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    );
  `.trim();
}

async function readExtensions(): Promise<ExtensionRow[]> {
  return prisma.$queryRawUnsafe<ExtensionRow[]>(
    "select extname from pg_extension where extname in ('pg_cron', 'pg_net') order by extname",
  );
}

async function readJobs(): Promise<CronJobRow[]> {
  return prisma.$queryRawUnsafe<CronJobRow[]>(
    "select jobid, jobname, schedule, active from cron.job where jobname in ($1, $2) order by jobname",
    EVENT_REMINDERS_JOB,
    PAYMENT_FOLLOW_UPS_JOB,
  );
}

function serializeJobId(value: bigint | number | string): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

export async function getSupabaseSchedulerStatus(): Promise<SupabaseSchedulerStatus> {
  const [extensions, jobs] = await Promise.all([readExtensions(), readJobs()]);
  const serializedJobs = jobs.map((job) => ({
    ...job,
    jobid: serializeJobId(job.jobid),
  }));
  const extensionSet = new Set(extensions.map((row) => row.extname));
  const jobNameSet = new Set(serializedJobs.map((job) => job.jobname));

  return {
    extensions: {
      pgCron: extensionSet.has("pg_cron"),
      pgNet: extensionSet.has("pg_net"),
    },
    jobs: serializedJobs,
    expectedJobs: {
      eventReminders: jobNameSet.has(EVENT_REMINDERS_JOB),
      paymentFollowUps: jobNameSet.has(PAYMENT_FOLLOW_UPS_JOB),
      accountFollowUps: jobNameSet.has(ACCOUNT_FOLLOW_UPS_JOB),
    },
  };
}

export async function reconcileSupabaseScheduler(options: {
  appUrl: string;
  cronSecret: string;
}): Promise<SupabaseSchedulerStatus> {
  await prisma.$executeRawUnsafe("create extension if not exists pg_cron");
  await prisma.$executeRawUnsafe("create extension if not exists pg_net");

  const existingJobs = await readJobs();
  const existingJobNames = new Set(existingJobs.map((job) => job.jobname));

  if (!existingJobNames.has(EVENT_REMINDERS_JOB)) {
    await prisma.$executeRawUnsafe(
      "select cron.schedule($1, $2, $3)",
      EVENT_REMINDERS_JOB,
      "*/15 * * * *",
      buildCronCommand("/api/internal/jobs/event-reminders", options.appUrl, options.cronSecret),
    );
  }

  if (!existingJobNames.has(PAYMENT_FOLLOW_UPS_JOB)) {
    await prisma.$executeRawUnsafe(
      "select cron.schedule($1, $2, $3)",
      PAYMENT_FOLLOW_UPS_JOB,
      "0 16 * * 1-5",
      buildCronCommand("/api/internal/jobs/payment-follow-ups", options.appUrl, options.cronSecret),
    );
  }

  if (!existingJobNames.has(ACCOUNT_FOLLOW_UPS_JOB)) {
    await prisma.$executeRawUnsafe(
      "select cron.schedule($1, $2, $3)",
      ACCOUNT_FOLLOW_UPS_JOB,
      "0 16 * * 1",
      buildCronCommand("/api/internal/jobs/account-follow-ups", options.appUrl, options.cronSecret),
    );
  }

  return getSupabaseSchedulerStatus();
}
