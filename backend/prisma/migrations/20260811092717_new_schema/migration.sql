/*
  Warnings:

  - You are about to drop the column `productId` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `Sale` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sku,storeId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[barcode,storeId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoiceNumber` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MOBILE_MONEY', 'OTHER');

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_productId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_storeId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_storeId_fkey";

-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "Sale_productId_idx";

-- DropIndex
DROP INDEX "Sale_storeId_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "optimalStock" INTEGER,
ADD COLUMN     "safetyStock" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "productId",
DROP COLUMN "quantity",
DROP COLUMN "total",
DROP COLUMN "unitPrice",
ADD COLUMN     "invoiceNumber" TEXT NOT NULL,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedStoreId" INTEGER,
ADD COLUMN     "createdById" INTEGER;

-- CreateTable
CREATE TABLE "StoreAssignment" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,

    CONSTRAINT "StoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreAssignment_userId_idx" ON "StoreAssignment"("userId");

-- CreateIndex
CREATE INDEX "StoreAssignment_storeId_idx" ON "StoreAssignment"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreAssignment_userId_storeId_key" ON "StoreAssignment"("userId", "storeId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "Product_storeId_quantity_idx" ON "Product"("storeId", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_storeId_key" ON "Product"("sku", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_storeId_key" ON "Product"("barcode", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_invoiceNumber_key" ON "Sale"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Sale_storeId_createdAt_idx" ON "Sale"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_userId_idx" ON "Sale"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedStoreId_fkey" FOREIGN KEY ("assignedStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreAssignment" ADD CONSTRAINT "StoreAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreAssignment" ADD CONSTRAINT "StoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
