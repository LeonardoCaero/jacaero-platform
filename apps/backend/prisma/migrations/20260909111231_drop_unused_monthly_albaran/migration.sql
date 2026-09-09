-- DropForeignKey
ALTER TABLE "MonthlyAlbaran" DROP CONSTRAINT "MonthlyAlbaran_clientId_fkey";

-- DropForeignKey
ALTER TABLE "MonthlyAlbaran" DROP CONSTRAINT "MonthlyAlbaran_contractId_fkey";

-- DropForeignKey
ALTER TABLE "MonthlyAlbaranLine" DROP CONSTRAINT "MonthlyAlbaranLine_albaranId_fkey";

-- DropForeignKey
ALTER TABLE "MonthlyAlbaranLine" DROP CONSTRAINT "MonthlyAlbaranLine_contractResourceId_fkey";

-- DropTable
DROP TABLE "MonthlyAlbaran";

-- DropTable
DROP TABLE "MonthlyAlbaranLine";

-- DropEnum
DROP TYPE "AlbaranStatus";
