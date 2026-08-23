-- AlterEnum
ALTER TYPE "EmailOrderStatus" RENAME TO "EmailOrderStatus_old";
CREATE TYPE "EmailOrderStatus" AS ENUM ('NEW', 'REVIEWED', 'IGNORED');
ALTER TABLE "EmailOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "EmailOrder" ALTER COLUMN "status" TYPE "EmailOrderStatus" USING ("status"::text::"EmailOrderStatus");
ALTER TABLE "EmailOrder" ALTER COLUMN "status" SET DEFAULT 'NEW';
DROP TYPE "EmailOrderStatus_old";

-- AlterTable
ALTER TABLE "EmailOrder"
  DROP COLUMN "summary",
  ADD COLUMN "quoteRef" TEXT,
  ADD COLUMN "orderDate" TIMESTAMP(3),
  ADD COLUMN "senderEmail" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "totalAmount" DECIMAL(12,2),
  ADD COLUMN "pdfAttachment" BYTEA,
  ADD COLUMN "quotedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryNoteAt" TIMESTAMP(3),
  ADD COLUMN "invoicedAt" TIMESTAMP(3);

ALTER TABLE "EmailOrder" ALTER COLUMN "senderEmail" DROP DEFAULT;

-- CreateTable
CREATE TABLE "EmailOrderLine" (
    "id" TEXT NOT NULL,
    "emailOrderId" TEXT NOT NULL,
    "lineNumber" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "deliveryDate" TIMESTAMP(3),

    CONSTRAINT "EmailOrderLine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmailOrderLine" ADD CONSTRAINT "EmailOrderLine_emailOrderId_fkey" FOREIGN KEY ("emailOrderId") REFERENCES "EmailOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
