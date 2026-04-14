-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_by" TEXT;

-- CreateIndex
CREATE INDEX "invoices_type_archived_at_idx" ON "invoices"("type", "archived_at");

-- CreateIndex
CREATE INDEX "invoices_created_by_archived_at_idx" ON "invoices"("created_by", "archived_at");

-- CreateIndex
CREATE INDEX "invoices_archived_by_archived_at_idx" ON "invoices"("archived_by", "archived_at");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
