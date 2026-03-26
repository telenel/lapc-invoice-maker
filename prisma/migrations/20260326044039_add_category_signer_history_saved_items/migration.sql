-- CreateEnum
CREATE TYPE "InvoiceCategory" AS ENUM ('COPY_TECH', 'CATERING', 'SUPPLIES', 'DEPARTMENT_PURCHASE');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "category" "InvoiceCategory" NOT NULL DEFAULT 'SUPPLIES';

-- CreateTable
CREATE TABLE "staff_signer_history" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "signer_staff_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_signer_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_line_items" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "department" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_signer_history_staff_id_signer_staff_id_position_key" ON "staff_signer_history"("staff_id", "signer_staff_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "saved_line_items_department_description_key" ON "saved_line_items"("department", "description");

-- AddForeignKey
ALTER TABLE "staff_signer_history" ADD CONSTRAINT "staff_signer_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_signer_history" ADD CONSTRAINT "staff_signer_history_signer_staff_id_fkey" FOREIGN KEY ("signer_staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
