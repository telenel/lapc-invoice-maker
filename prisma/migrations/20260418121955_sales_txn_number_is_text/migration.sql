-- Fix: Transaction_Header.TranNumber in Prism is char(25), not integer.
-- Real values like "WO-00132214-P" are work-order style strings. Retype
-- the mirror column to TEXT. Safe because no rows exist yet (backfill
-- hadn't completed) and no UI or sync code reads this column yet.

ALTER TABLE "sales_transactions"
  ALTER COLUMN "tran_number" TYPE TEXT USING "tran_number"::TEXT;
