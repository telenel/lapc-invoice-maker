/*
  Warnings:

  - The `category` column on the `invoices` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[access_code]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable: convert enum column to varchar, preserving existing data
ALTER TABLE "invoices" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
ALTER TABLE "invoices" ALTER COLUMN "category" SET DEFAULT 'SUPPLIES';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "access_code" TEXT,
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- DropEnum
DROP TYPE "InvoiceCategory";

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_access_code_key" ON "users"("access_code");
