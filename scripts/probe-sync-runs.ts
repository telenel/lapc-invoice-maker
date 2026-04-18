/**
 * Verify the prism-pull cron is actually firing in production.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

async function main() {
  const s = getSupabaseAdminClient();
  const { data, error } = await s
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);
  console.log("=== last 25 sync_runs ===");
  console.table(data);

  const scheduledCount = (data ?? []).filter(r => r.triggered_by === "scheduled").length;
  console.log(`of the last ${data?.length ?? 0}: ${scheduledCount} scheduled, ${(data?.length ?? 0) - scheduledCount} manual`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
