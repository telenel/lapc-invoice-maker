-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_created_by_fkey";

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
