import { readBuildMeta } from "@/lib/build-meta";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";
import { getJobSchedulerMode } from "@/lib/job-scheduler";

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
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    },
  };
}
