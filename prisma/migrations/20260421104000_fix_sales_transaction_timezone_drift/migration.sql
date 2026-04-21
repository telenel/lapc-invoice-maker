-- Repair mirrored Prism sales timestamps that were stored as UTC wall-clock
-- values instead of Los Angeles local instants.
UPDATE "sales_transactions"
SET
  "process_date" = ("process_date" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles',
  "create_date" = CASE
    WHEN "create_date" IS NULL THEN NULL
    ELSE ("create_date" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles'
  END,
  "dtl_create_date" = CASE
    WHEN "dtl_create_date" IS NULL THEN NULL
    ELSE ("dtl_create_date" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles'
  END;

UPDATE "sales_transactions_sync_state"
SET
  "last_process_date" = CASE
    WHEN "last_process_date" IS NULL THEN NULL
    ELSE ("last_process_date" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles'
  END;

SELECT recompute_product_sales_aggregates();
