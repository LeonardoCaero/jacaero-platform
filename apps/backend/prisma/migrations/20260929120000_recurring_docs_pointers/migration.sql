-- DropTable
DROP TABLE "RecurringAlbaranTemplate";

-- AlterTable
ALTER TABLE "EmailOrder" ADD COLUMN "contractResourceId" TEXT,
ADD COLUMN "lastAlbaranPath" TEXT,
ADD COLUMN "lastAlbaranPeriod" TIMESTAMP(3),
ADD COLUMN "lastAlbaranAt" TIMESTAMP(3),
ADD COLUMN "lastFacturaPath" TEXT,
ADD COLUMN "lastFacturaPeriod" TIMESTAMP(3),
ADD COLUMN "lastFacturaAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EmailOrder_contractResourceId_idx" ON "EmailOrder"("contractResourceId");

-- AddForeignKey
ALTER TABLE "EmailOrder" ADD CONSTRAINT "EmailOrder_contractResourceId_fkey" FOREIGN KEY ("contractResourceId") REFERENCES "ContractResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
