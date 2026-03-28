-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "cost_price" DECIMAL(10,2),
ADD COLUMN     "is_taxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "margin_override" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "catering_details" JSONB,
ADD COLUMN     "is_catering_event" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "margin_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "margin_percent" DECIMAL(5,2),
ADD COLUMN     "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.0975;
