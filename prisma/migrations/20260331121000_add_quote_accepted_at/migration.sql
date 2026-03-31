-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "accepted_at" TIMESTAMP(3);

UPDATE "invoices" AS i
SET "accepted_at" = accepted_views."accepted_at"
FROM (
  SELECT q."id", approval_notifications."accepted_at" AS "accepted_at"
  FROM "invoices" AS q
  LEFT JOIN (
    SELECT "quote_id", MIN("created_at") AS "accepted_at"
    FROM "notifications"
    WHERE "type" = 'QUOTE_APPROVED'
      AND "quote_id" IS NOT NULL
    GROUP BY "quote_id"
  ) AS approval_notifications ON approval_notifications."quote_id" = q."id"
  WHERE q."type" = 'QUOTE'
    AND q."quote_status" = 'ACCEPTED'
    AND q."accepted_at" IS NULL
) AS accepted_views
WHERE i."id" = accepted_views."id";
