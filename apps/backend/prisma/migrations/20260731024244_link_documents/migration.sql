-- AlterTable
ALTER TABLE "EmailOrder"
  ADD COLUMN "albaranNumber" TEXT,
  ADD COLUMN "facturaNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmailOrder_orderNumber_key" ON "EmailOrder"("orderNumber");
