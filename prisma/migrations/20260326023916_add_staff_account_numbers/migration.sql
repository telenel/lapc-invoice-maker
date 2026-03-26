-- CreateTable
CREATE TABLE "staff_account_numbers" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_account_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_account_numbers_staff_id_account_code_key" ON "staff_account_numbers"("staff_id", "account_code");

-- AddForeignKey
ALTER TABLE "staff_account_numbers" ADD CONSTRAINT "staff_account_numbers_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
