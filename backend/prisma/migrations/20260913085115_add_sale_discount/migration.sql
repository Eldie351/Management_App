-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('AMOUNT', 'PERCENT');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: les ventes existantes n'avaient pas de remise, leur sous-total
-- correspond donc au total déjà enregistré.
UPDATE "Sale" SET "subtotal" = "totalAmount";
