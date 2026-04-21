/**
 * One-time backfill: pulls 3 years of Pierce POS transaction lines from Prism
 * into Supabase `sales_transactions`, then runs the aggregate recompute.
 *
 * Idempotent guard: exits early if backfill_completed_at is already set.
 * Safe to re-run after a partial failure because of ON CONFLICT on tran_dtl_id
 * and because the completion flag is written only after recompute succeeds.
 *
 * Usage:
 *   npx tsx scripts/backfill-prism-transactions.ts
 *   npx tsx scripts/backfill-prism-transactions.ts --force  (bypass idempotency)
 *
 * Prerequisites:
 *   - Prism tunnel is up (campus Windows or SSH bridge).
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are in .env / .env.local.
 *   - The Phase A migration has been applied.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, isPrismConfigured } from "@/lib/prism";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { runSalesTxnBackfill } from "@/domains/product/sales-txn-backfill";

async function main() {
  const force = process.argv.includes("--force");
  if (!isPrismConfigured()) {
    throw new Error("Prism is not configured. Set PRISM_SERVER / PRISM_USER / PRISM_PASSWORD.");
  }

  await runSalesTxnBackfill({
    force,
    supabase: getSupabaseAdminClient(),
    prism: await getPrismPool(),
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
