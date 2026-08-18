-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "businessId" TEXT;

-- CreateIndex
CREATE INDEX "Event_businessId_idx" ON "Event"("businessId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
