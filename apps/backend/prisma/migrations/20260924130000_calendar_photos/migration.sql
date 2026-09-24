-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
