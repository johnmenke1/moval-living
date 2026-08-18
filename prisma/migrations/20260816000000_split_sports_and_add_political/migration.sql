-- Split SPORTS into HS_SPORTS, COLLEGE_SPORTS, LEAGUE_SPORTS and add POLITICAL.
-- Also add Event.esEnEspanol Boolean for the new public Spanish-language filter.
--
-- Step 1: Migrate data BEFORE the enum swap, because the new enum does not
-- contain 'SPORTS' and the cast in step 2 would otherwise fail.
--
-- Migration rules (per Johnny 2026-08-16):
--   venueTag IN ('UCR', 'CBU') → COLLEGE_SPORTS
--   venueTag NOT IN ('UCR', 'CBU') → HS_SPORTS
--   LEAGUE_SPORTS is unused at migration time; it's added for future use.

BEGIN;

-- Data migration: rewrite SPORTS rows based on venueTag.
UPDATE "Event"
SET    "category" = 'COLLEGE_SPORTS'
WHERE  "category" = 'SPORTS'
  AND  "venueTag" IN ('UCR', 'CBU');

UPDATE "Event"
SET    "category" = 'HS_SPORTS'
WHERE  "category" = 'SPORTS'
  AND  ("venueTag" IS NULL OR "venueTag" NOT IN ('UCR', 'CBU'));

-- Step 2: Schema changes. Add the new enum values first via a type swap
-- (Postgres can't DROP an enum value, so we create a new type and rename).

CREATE TYPE "EventCategory_new" AS ENUM (
  'HS_SPORTS',
  'COLLEGE_SPORTS',
  'LEAGUE_SPORTS',
  'POLITICAL',
  'MUSIC',
  'ARTS',
  'EDUCATIONAL',
  'FUNDRAISERS',
  'COMMUNITY',
  'FAMILY',
  'FOOD_DRINK',
  'HOLIDAY_CELEBRATIONS'
);

ALTER TABLE "Event" ALTER COLUMN "category" TYPE "EventCategory_new"
  USING ("category"::text::"EventCategory_new");

ALTER TYPE "EventCategory" RENAME TO "EventCategory_old";
ALTER TYPE "EventCategory_new" RENAME TO "EventCategory";
DROP TYPE "public"."EventCategory_old";

-- Step 3: Add the Spanish-language flag.

ALTER TABLE "Event" ADD COLUMN "esEnEspanol" BOOLEAN NOT NULL DEFAULT false;

-- Step 4: Index for the public "En Español" filter.

CREATE INDEX "Event_esEnEspanol_idx" ON "Event"("esEnEspanol");

COMMIT;