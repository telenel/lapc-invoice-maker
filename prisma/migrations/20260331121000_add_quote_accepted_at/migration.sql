-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "accepted_at" TIMESTAMP(3);

UPDATE "invoices"
SET "accepted_at" = "converted_at"
WHERE "type" = 'QUOTE'
  AND "quote_status" = 'ACCEPTED'
  AND "accepted_at" IS NULL
  AND "converted_at" IS NOT NULL;

UPDATE "invoices" AS i
SET "accepted_at" = accepted_views."accepted_at"
FROM (
  SELECT "invoice_id", MIN("viewed_at") AS "accepted_at"
  FROM "quote_views"
  WHERE "responded_with" = 'ACCEPTED'
  GROUP BY "invoice_id"
) AS accepted_views
WHERE i."id" = accepted_views."invoice_id"
  AND i."type" = 'QUOTE'
  AND i."quote_status" = 'ACCEPTED'
  AND i."accepted_at" IS NULL;

UPDATE "invoices"
SET "accepted_at" = "updated_at"
WHERE "type" = 'QUOTE'
  AND "quote_status" = 'ACCEPTED'
  AND "accepted_at" IS NULL;
