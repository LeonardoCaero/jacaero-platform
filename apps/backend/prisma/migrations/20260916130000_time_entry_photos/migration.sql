-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
