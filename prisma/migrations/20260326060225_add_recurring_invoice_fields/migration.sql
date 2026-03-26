-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "next_recurring_date" DATE,
ADD COLUMN     "recurring_email" TEXT,
ADD COLUMN     "recurring_interval" TEXT;
