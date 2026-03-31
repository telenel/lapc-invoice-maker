-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "accepted_at" TIMESTAMP(3);

UPDATE "invoices" AS i
SET "accepted_at" = accepted_views."accepted_at"
FROM (
  SELECT "quote_id", MIN("created_at") AS "accepted_at"
  FROM "notifications"
  WHERE "type" = 'QUOTE_APPROVED'
    AND "quote_id" IS NOT NULL
  GROUP BY "quote_id"
) AS accepted_views
WHERE i."id" = accepted_views."quote_id"
  AND i."type" = 'QUOTE'
  AND i."quote_status" = 'ACCEPTED'
  AND i."accepted_at" IS NULL;
