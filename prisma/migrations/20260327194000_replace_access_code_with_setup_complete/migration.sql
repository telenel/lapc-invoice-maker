-- Drop access code column and its unique index
ALTER TABLE "users" DROP COLUMN IF EXISTS "access_code";

-- Convert needs_setup to setup_complete (inverted logic)
ALTER TABLE "users" ADD COLUMN "setup_complete" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "setup_complete" = NOT "needs_setup";
ALTER TABLE "users" DROP COLUMN "needs_setup";
