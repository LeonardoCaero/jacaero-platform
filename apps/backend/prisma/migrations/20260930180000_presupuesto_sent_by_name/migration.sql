DELETE FROM "PresupuestoSent";

-- DropIndex
DROP INDEX "PresupuestoSent_year_number_key";

-- AlterTable
ALTER TABLE "PresupuestoSent" ADD COLUMN "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoSent_year_name_key" ON "PresupuestoSent"("year", "name");
