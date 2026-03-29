/*
  Warnings:

  - A unique constraint covering the columns `[revised_from_quote_id]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuoteStatus" ADD VALUE 'SUBMITTED_EMAIL';
ALTER TYPE "QuoteStatus" ADD VALUE 'SUBMITTED_MANUAL';
ALTER TYPE "QuoteStatus" ADD VALUE 'REVISED';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "revised_from_quote_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_revised_from_quote_id_key" ON "invoices"("revised_from_quote_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_revised_from_quote_id_fkey" FOREIGN KEY ("revised_from_quote_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
