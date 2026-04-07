-- AlterTable
ALTER TABLE "textbook_requisitions" ADD COLUMN     "employee_id" TEXT;

-- CreateIndex
CREATE INDEX "textbook_requisitions_employee_id_idx" ON "textbook_requisitions"("employee_id");
