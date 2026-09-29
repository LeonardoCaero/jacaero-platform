-- CreateEnum
CREATE TYPE "MonthlyDocKind" AS ENUM ('albaran', 'factura');

-- AlterTable
ALTER TABLE "EmailOrder" DROP COLUMN "lastAlbaranPath",
DROP COLUMN "lastAlbaranPeriod",
DROP COLUMN "lastAlbaranAt",
DROP COLUMN "lastFacturaPath",
DROP COLUMN "lastFacturaPeriod",
DROP COLUMN "lastFacturaAt";

-- CreateTable
CREATE TABLE "MonthlyDocument" (
    "id" TEXT NOT NULL,
    "emailOrderId" TEXT NOT NULL,
    "kind" "MonthlyDocKind" NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "number" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "nameMismatch" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyDocument_path_key" ON "MonthlyDocument"("path");

-- CreateIndex
CREATE INDEX "MonthlyDocument_emailOrderId_kind_period_idx" ON "MonthlyDocument"("emailOrderId", "kind", "period");

-- AddForeignKey
ALTER TABLE "MonthlyDocument" ADD CONSTRAINT "MonthlyDocument_emailOrderId_fkey" FOREIGN KEY ("emailOrderId") REFERENCES "EmailOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
