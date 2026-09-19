/*
  Warnings:

  - Added the required column `recipientId` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "recipientId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Ticket_recipientId_idx" ON "Ticket"("recipientId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
