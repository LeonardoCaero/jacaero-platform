-- AlterTable
ALTER TABLE "RecurringAlbaranTemplate" DROP COLUMN "titleTemplate",
DROP COLUMN "templateDocx",
DROP COLUMN "lastPeriod",
DROP COLUMN "lastNumber",
ADD COLUMN "lastAlbaranPath" TEXT,
ADD COLUMN "lastAlbaranPeriod" TIMESTAMP(3),
ADD COLUMN "lastAlbaranAt" TIMESTAMP(3),
ADD COLUMN "lastFacturaPath" TEXT,
ADD COLUMN "lastFacturaPeriod" TIMESTAMP(3),
ADD COLUMN "lastFacturaAt" TIMESTAMP(3);
