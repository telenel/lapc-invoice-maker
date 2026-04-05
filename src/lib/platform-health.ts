import { readBuildMeta } from "@/lib/build-meta";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";
import {
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
    mode: "app" | "supabase";
    confirmed: boolean;
    cronSecretConfigured: boolean;
  };
};

export async function getPlatformHealth(): Promise<PlatformHealth> {
  const buildMeta = await readBuildMeta();

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
      mode: getJobSchedulerMode(),
      confirmed: isSupabaseSchedulerConfirmed(),
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    },
  };
}
