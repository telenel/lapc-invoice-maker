import { readBuildMeta } from "@/lib/build-meta";
import { getLegacyStorageAudit } from "@/lib/storage-audit";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";
import {
  getActiveJobSchedulerMode,
  getJobSchedulerMode,
  isSupabaseSchedulerConfirmed,
} from "@/lib/job-scheduler";

export type PlatformHealth = {
  supabase: {
    runtimePublicEnv: boolean;
    runtimeAdminEnv: boolean;
    buildPublicEnv: {
      supabaseUrlConfigured: boolean;
      supabaseAnonKeyConfigured: boolean;
    };
  };
  scheduler: {
    configuredMode: "app" | "supabase";
    activeMode: "app" | "supabase";
    confirmed: boolean;
    cronSecretConfigured: boolean;
  };
  storage: {
    legacyFilesystemFallbackEnabled: boolean;
    invoicePdfPaths: number;
    prismcorePaths: number;
    printQuotePdfPaths: number;
    totalLegacyReferences: number;
  };
};

export async function getPlatformHealth(): Promise<PlatformHealth> {
  const [buildMeta, storage] = await Promise.all([
    readBuildMeta(),
    getLegacyStorageAudit(),
  ]);

  return {
    supabase: {
      runtimePublicEnv: hasSupabasePublicEnv(),
      runtimeAdminEnv: hasSupabaseAdminEnv(),
      buildPublicEnv: {
        supabaseUrlConfigured: Boolean(buildMeta?.publicEnv?.supabaseUrlConfigured),
        supabaseAnonKeyConfigured: Boolean(buildMeta?.publicEnv?.supabaseAnonKeyConfigured),
      },
    },
    scheduler: {
      configuredMode: getJobSchedulerMode(),
      activeMode: getActiveJobSchedulerMode(),
      confirmed: isSupabaseSchedulerConfirmed(),
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    },
    storage,
  };
}
