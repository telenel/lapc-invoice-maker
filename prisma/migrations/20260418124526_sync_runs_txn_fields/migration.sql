-- Track the transaction-history step of each sync run alongside the existing
-- product-catalog metrics. All nullable so rows from before Phase B stay valid.
ALTER TABLE "sync_runs"
  ADD COLUMN IF NOT EXISTS "txns_added"             INTEGER,
  ADD COLUMN IF NOT EXISTS "aggregates_updated"     INTEGER,
  ADD COLUMN IF NOT EXISTS "txn_sync_duration_ms"   INTEGER;
