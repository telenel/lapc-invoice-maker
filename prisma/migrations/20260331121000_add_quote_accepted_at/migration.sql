-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "accepted_at" TIMESTAMP(3);

-- Backfill existing accepted quotes so reminder timing stays stable after deploy.
UPDATE "invoices"
SET "accepted_at" = "updated_at"
WHERE "type" = 'QUOTE'
  AND "quote_status" = 'ACCEPTED'
  AND "accepted_at" IS NULL;
