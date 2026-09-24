-- CreateEnum
CREATE TYPE "ReceiptActionType" AS ENUM ('UPDATE', 'DELETE');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "requestedAction" "ReceiptActionType";

-- CreateTable
CREATE TABLE "ReceiptAction" (
    "id" SERIAL NOT NULL,
    "type" "ReceiptActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "totalBefore" DOUBLE PRECISION NOT NULL,
    "totalAfter" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleId" INTEGER,
    "storeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "ticketId" INTEGER,

    CONSTRAINT "ReceiptAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptAction_storeId_createdAt_idx" ON "ReceiptAction"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "ReceiptAction_saleId_idx" ON "ReceiptAction"("saleId");

-- AddForeignKey
ALTER TABLE "ReceiptAction" ADD CONSTRAINT "ReceiptAction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAction" ADD CONSTRAINT "ReceiptAction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAction" ADD CONSTRAINT "ReceiptAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAction" ADD CONSTRAINT "ReceiptAction_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
