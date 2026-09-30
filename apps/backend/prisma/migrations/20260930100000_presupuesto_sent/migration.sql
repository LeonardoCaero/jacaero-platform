-- CreateTable
CREATE TABLE "PresupuestoSent" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "recipients" TEXT NOT NULL,

    CONSTRAINT "PresupuestoSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoSent_year_number_key" ON "PresupuestoSent"("year", "number");
