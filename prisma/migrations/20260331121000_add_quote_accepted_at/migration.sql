-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "accepted_at" TIMESTAMP(3);

UPDATE "invoices" AS i
SET "accepted_at" = accepted_views."accepted_at"
FROM (
  SELECT "id", "updated_at" AS "accepted_at"
  FROM "invoices"
) AS accepted_views
WHERE i."id" = accepted_views."id"
  AND i."type" = 'QUOTE'
  AND i."quote_status" = 'ACCEPTED'
  AND i."accepted_at" IS NULL;
