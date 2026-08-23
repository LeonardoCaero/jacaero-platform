CREATE TYPE "QuoteCategory" AS ENUM ('PRESUPUESTO', 'HORAS', 'MATERIAL');

ALTER TABLE "EmailOrder" DROP COLUMN "quoteNotApplicable";
ALTER TABLE "EmailOrder" ADD COLUMN "quoteCategory" "QuoteCategory";
