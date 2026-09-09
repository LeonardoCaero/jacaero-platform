-- CreateTable
CREATE TABLE "RecurringAlbaranTemplate" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "templateDocx" BYTEA NOT NULL,
    "lastPeriod" TIMESTAMP(3),
    "lastNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringAlbaranTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringAlbaranTemplate_orderNumber_key" ON "RecurringAlbaranTemplate"("orderNumber");

-- AddForeignKey
ALTER TABLE "RecurringAlbaranTemplate" ADD CONSTRAINT "RecurringAlbaranTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
