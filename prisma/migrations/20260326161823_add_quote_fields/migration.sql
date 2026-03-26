/*
  Warnings:

  - A unique constraint covering the columns `[quote_number]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[converted_from_quote_id]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'QUOTE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "converted_at" TIMESTAMP(3),
ADD COLUMN     "converted_from_quote_id" TEXT,
ADD COLUMN     "expiration_date" DATE,
ADD COLUMN     "quote_number" TEXT,
ADD COLUMN     "quote_status" "QuoteStatus",
ADD COLUMN     "recipient_email" TEXT,
ADD COLUMN     "recipient_name" TEXT,
ADD COLUMN     "recipient_org" TEXT,
ADD COLUMN     "type" "DocumentType" NOT NULL DEFAULT 'INVOICE',
ALTER COLUMN "invoice_number" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_quote_number_key" ON "invoices"("quote_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_converted_from_quote_id_key" ON "invoices"("converted_from_quote_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_converted_from_quote_id_fkey" FOREIGN KEY ("converted_from_quote_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
