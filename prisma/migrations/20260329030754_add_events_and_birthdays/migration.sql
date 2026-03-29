-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MEETING', 'SEMINAR', 'VENDOR', 'OTHER');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "birth_day" INTEGER,
ADD COLUMN     "birth_month" INTEGER;

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "color" TEXT NOT NULL,
    "recurrence" "Recurrence",
    "recurrence_end" DATE,
    "reminder_minutes" INTEGER,
    "reminder_sent_dates" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
