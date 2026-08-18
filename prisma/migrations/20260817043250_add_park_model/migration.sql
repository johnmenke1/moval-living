◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (0) from .env.local // tip: ◈ secrets for agents [www.dotenvx.com]
-- CreateEnum
CREATE TYPE "ParkType" AS ENUM ('PARK', 'GOLF', 'REC_CENTER');

-- CreateTable
CREATE TABLE "Park" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ParkType" NOT NULL,
    "googlePlaceId" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Moreno Valley',
    "state" TEXT NOT NULL DEFAULT 'CA',
    "zip" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "website" TEXT,
    "hoursJson" JSONB,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "heroPhotoUrl" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blurb" TEXT,
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Park_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Park_slug_key" ON "Park"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Park_googlePlaceId_key" ON "Park"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Park_type_idx" ON "Park"("type");

-- CreateIndex
CREATE INDEX "Park_slug_idx" ON "Park"("slug");

-- CreateIndex
CREATE INDEX "Park_featured_idx" ON "Park"("featured");

