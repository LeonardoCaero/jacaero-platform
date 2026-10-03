-- CreateEnum
CREATE TYPE "QuoteState" AS ENUM ('ANULADO', 'STANDBY', 'SUSTITUIDO');

-- CreateTable
CREATE TABLE "DocumentNote" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "docName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteStatus" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "docName" TEXT NOT NULL,
    "status" "QuoteState" NOT NULL,
    "replacedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentNote_category_year_docName_idx" ON "DocumentNote"("category", "year", "docName");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteStatus_year_docName_key" ON "QuoteStatus"("year", "docName");

-- AddForeignKey
ALTER TABLE "DocumentNote" ADD CONSTRAINT "DocumentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
