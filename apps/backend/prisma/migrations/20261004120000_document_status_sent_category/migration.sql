-- AlterTable
ALTER TABLE "QuoteStatus" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'presupuesto';

-- DropIndex
DROP INDEX "QuoteStatus_year_docName_key";

-- CreateIndex
CREATE UNIQUE INDEX "QuoteStatus_category_year_docName_key" ON "QuoteStatus"("category", "year", "docName");

-- AlterTable
ALTER TABLE "PresupuestoSent" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'presupuesto';

-- DropIndex
DROP INDEX "PresupuestoSent_year_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoSent_category_year_name_key" ON "PresupuestoSent"("category", "year", "name");
