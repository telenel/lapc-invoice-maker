-- CreateEnum
CREATE TYPE "PrintPricingService" AS ENUM ('COPY', 'POSTER', 'BINDING', 'SCANNING');

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.0975;

-- CreateTable
CREATE TABLE "print_pricing_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "shop_title" TEXT NOT NULL DEFAULT 'Campus Print Shop',
    "quote_prefix" TEXT NOT NULL DEFAULT 'PSQ',
    "quote_disclaimer" TEXT NOT NULL DEFAULT 'Final pricing subject to file review and production requirements.',
    "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tax_rate_basis_points" INTEGER NOT NULL DEFAULT 0,
    "bw_duplex_multiplier_basis_points" INTEGER NOT NULL DEFAULT 17000,
    "color_duplex_multiplier_basis_points" INTEGER NOT NULL DEFAULT 18500,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_pricing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_pricing_tiers" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "service" "PrintPricingService" NOT NULL,
    "variant" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "min_quantity" INTEGER,
    "max_quantity" INTEGER,
    "unit_price_cents" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_quotes" (
    "id" TEXT NOT NULL,
    "pricing_config_id" TEXT NOT NULL,
    "quote_number" TEXT NOT NULL,
    "created_by" TEXT,
    "requester_name" TEXT NOT NULL DEFAULT '',
    "requester_email" TEXT NOT NULL DEFAULT '',
    "requester_organization" TEXT NOT NULL DEFAULT '',
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tax_rate_basis_points" INTEGER NOT NULL DEFAULT 0,
    "disclaimer" TEXT NOT NULL DEFAULT '',
    "shop_title" TEXT NOT NULL DEFAULT '',
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_quote_line_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "service" "PrintPricingService" NOT NULL,
    "variant" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,
    "metadata" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "print_pricing_tiers_config_id_service_sort_order_idx" ON "print_pricing_tiers"("config_id", "service", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "print_quotes_quote_number_key" ON "print_quotes"("quote_number");

-- CreateIndex
CREATE INDEX "print_quotes_created_at_idx" ON "print_quotes"("created_at");

-- CreateIndex
CREATE INDEX "print_quote_line_items_quote_id_sort_order_idx" ON "print_quote_line_items"("quote_id", "sort_order");

-- AddForeignKey
ALTER TABLE "print_pricing_tiers" ADD CONSTRAINT "print_pricing_tiers_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "print_pricing_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_quotes" ADD CONSTRAINT "print_quotes_pricing_config_id_fkey" FOREIGN KEY ("pricing_config_id") REFERENCES "print_pricing_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_quotes" ADD CONSTRAINT "print_quotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_quote_line_items" ADD CONSTRAINT "print_quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "print_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
