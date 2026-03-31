-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "payment_method" TEXT;

-- CreateTable
CREATE TABLE "quote_follow_ups" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "quote_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "quote_follow_ups_invoice_id_sent_at_idx" ON "quote_follow_ups"("invoice_id", "sent_at");

-- AddForeignKey
ALTER TABLE "quote_follow_ups" ADD CONSTRAINT "quote_follow_ups_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
