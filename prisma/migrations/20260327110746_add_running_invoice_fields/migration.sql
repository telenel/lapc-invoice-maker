-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "is_running" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "running_title" TEXT;
