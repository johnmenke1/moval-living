-- AddColumn Submission.venueId + address/cache fields
ALTER TABLE "Submission" ADD COLUMN "venueId" TEXT;
ALTER TABLE "Submission" ADD COLUMN "address" TEXT;
ALTER TABLE "Submission" ADD COLUMN "city" TEXT;
ALTER TABLE "Submission" ADD COLUMN "state" TEXT;
ALTER TABLE "Submission" ADD COLUMN "zip" TEXT;
CREATE INDEX "Submission_venueId_idx" ON "Submission"("venueId");

-- AddForeignKey Submission.venueId -> Venue.id
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
