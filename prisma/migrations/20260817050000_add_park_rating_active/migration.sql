-- Add Google reputation + soft-hide fields to Park
ALTER TABLE "Park" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Park" ADD COLUMN "googleRating" DOUBLE PRECISION;
ALTER TABLE "Park" ADD COLUMN "googleReviewCount" INTEGER;
CREATE INDEX "Park_isActive_idx" ON "Park"("isActive");
