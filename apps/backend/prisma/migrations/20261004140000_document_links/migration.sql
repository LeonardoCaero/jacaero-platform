-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "fromCategory" TEXT NOT NULL,
    "fromYear" INTEGER NOT NULL,
    "fromName" TEXT NOT NULL,
    "toCategory" TEXT NOT NULL,
    "toYear" INTEGER NOT NULL,
    "toNumber" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentLink_toCategory_toYear_idx" ON "DocumentLink"("toCategory", "toYear");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_from_to_key" ON "DocumentLink"("fromCategory", "fromYear", "fromName", "toCategory", "toName");
