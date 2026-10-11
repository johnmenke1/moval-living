-- Halloween Home Decorating Contest tables.
-- Run once on the production Postgres (idempotent). Requires the existing "Status" enum.
BEGIN;

CREATE TABLE IF NOT EXISTS "HalloweenEntry" (
  "id"              text PRIMARY KEY NOT NULL,
  "displayName"     text NOT NULL,
  "tagline"         text,
  "description"     text,
  "category"        text,
  "contactName"     text NOT NULL,
  "contactEmail"    text NOT NULL,
  "contactPhone"    text,
  "streetAddress"   text NOT NULL,
  "city"            text NOT NULL DEFAULT 'Moreno Valley',
  "zip"             text,
  "addressKey"      text NOT NULL,
  "latitude"        double precision,
  "longitude"       double precision,
  "showExactAddress" boolean NOT NULL DEFAULT false,
  "publicLatitude"  double precision,
  "publicLongitude" double precision,
  "locationLabel"   text,
  "photoUrls"       text[] NOT NULL DEFAULT ARRAY[]::text[],
  "status"          "Status" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" text,
  "ipHash"          text,
  "createdAt"       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt"      timestamp(3),
  "updatedAt"       timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "HalloweenEntry_addressKey_key" ON "HalloweenEntry" ("addressKey");
CREATE INDEX IF NOT EXISTS "HalloweenEntry_status_idx" ON "HalloweenEntry" ("status");
CREATE INDEX IF NOT EXISTS "HalloweenEntry_ipHash_createdAt_idx" ON "HalloweenEntry" ("ipHash", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "HalloweenVote" (
  "id"        text PRIMARY KEY NOT NULL,
  "entryId"   text NOT NULL,
  "ipHash"    text NOT NULL,
  "deviceId"  text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HalloweenVote_entryId_fkey" FOREIGN KEY ("entryId")
    REFERENCES "HalloweenEntry"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "HalloweenVote_entryId_idx" ON "HalloweenVote" ("entryId");
CREATE UNIQUE INDEX IF NOT EXISTS "HalloweenVote_entryId_ipHash_key" ON "HalloweenVote" ("entryId", "ipHash");
CREATE UNIQUE INDEX IF NOT EXISTS "HalloweenVote_entryId_deviceId_key" ON "HalloweenVote" ("entryId", "deviceId");

COMMIT;
