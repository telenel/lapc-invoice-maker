-- Rename table (preserves existing data)
ALTER TABLE "quote_follow_ups" RENAME TO "follow_ups";

-- Add new columns
ALTER TABLE "follow_ups" ADD COLUMN "series_id" TEXT;
ALTER TABLE "follow_ups" ADD COLUMN "share_token" TEXT;
ALTER TABLE "follow_ups" ADD COLUMN "series_status" TEXT;
ALTER TABLE "follow_ups" ADD COLUMN "max_attempts" INTEGER;

-- Add indexes
CREATE UNIQUE INDEX "follow_ups_share_token_key" ON "follow_ups"("share_token");
CREATE INDEX "follow_ups_series_id_idx" ON "follow_ups"("series_id");
CREATE INDEX "follow_ups_series_status_type_idx" ON "follow_ups"("series_status", "type");

-- Rename existing indexes to match new table name
ALTER INDEX "quote_follow_ups_pkey" RENAME TO "follow_ups_pkey";
ALTER INDEX "quote_follow_ups_invoice_id_sent_at_idx" RENAME TO "follow_ups_invoice_id_sent_at_idx";

-- Rename foreign key constraint to match new table name
ALTER TABLE "follow_ups" RENAME CONSTRAINT "quote_follow_ups_invoice_id_fkey" TO "follow_ups_invoice_id_fkey";
