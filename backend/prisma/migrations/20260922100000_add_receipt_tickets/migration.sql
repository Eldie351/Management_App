-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('RESTOCK', 'RECEIPT');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "saleId" INTEGER,
ADD COLUMN     "saleInvoiceNumber" TEXT,
ADD COLUMN     "type" "TicketType" NOT NULL DEFAULT 'RESTOCK',
ALTER COLUMN "productId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Ticket_saleId_idx" ON "Ticket"("saleId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

