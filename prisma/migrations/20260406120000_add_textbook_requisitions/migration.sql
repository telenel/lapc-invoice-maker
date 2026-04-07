-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('PENDING', 'ORDERED', 'ON_SHELF');

-- CreateEnum
CREATE TYPE "RequisitionSource" AS ENUM ('FACULTY_FORM', 'STAFF_CREATED');

-- CreateEnum
CREATE TYPE "BookBinding" AS ENUM ('HARDCOVER', 'PAPERBACK', 'LOOSE_LEAF', 'DIGITAL');

-- CreateEnum
CREATE TYPE "BookType" AS ENUM ('PHYSICAL', 'OER');

-- CreateTable
CREATE TABLE "textbook_requisitions" (
    "id" TEXT NOT NULL,
    "instructor_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "sections" TEXT NOT NULL,
    "enrollment" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "req_year" INTEGER NOT NULL,
    "additional_info" TEXT,
    "staff_notes" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "RequisitionSource" NOT NULL DEFAULT 'FACULTY_FORM',
    "created_by" TEXT,
    "last_status_changed_at" TIMESTAMP(3),
    "last_status_changed_by" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,

    CONSTRAINT "textbook_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition_books" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "book_number" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isbn" TEXT NOT NULL,
    "edition" TEXT,
    "copyright_year" TEXT,
    "volume" TEXT,
    "publisher" TEXT,
    "binding" "BookBinding",
    "book_type" "BookType" NOT NULL DEFAULT 'PHYSICAL',
    "oer_link" TEXT,

    CONSTRAINT "requisition_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition_notifications" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "sent_by" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,

    CONSTRAINT "requisition_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "textbook_requisitions_status_idx" ON "textbook_requisitions"("status");

-- CreateIndex
CREATE INDEX "textbook_requisitions_term_req_year_idx" ON "textbook_requisitions"("term", "req_year");

-- CreateIndex
CREATE INDEX "textbook_requisitions_submitted_at_idx" ON "textbook_requisitions"("submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "requisition_books_requisition_id_book_number_key" ON "requisition_books"("requisition_id", "book_number");

-- CreateIndex
CREATE INDEX "requisition_notifications_requisition_id_type_idx" ON "requisition_notifications"("requisition_id", "type");

-- CreateIndex
CREATE INDEX "requisition_notifications_requisition_id_sent_at_idx" ON "requisition_notifications"("requisition_id", "sent_at");

-- AddForeignKey
ALTER TABLE "textbook_requisitions" ADD CONSTRAINT "textbook_requisitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "textbook_requisitions" ADD CONSTRAINT "textbook_requisitions_last_status_changed_by_fkey" FOREIGN KEY ("last_status_changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_books" ADD CONSTRAINT "requisition_books_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "textbook_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_notifications" ADD CONSTRAINT "requisition_notifications_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "textbook_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_notifications" ADD CONSTRAINT "requisition_notifications_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
