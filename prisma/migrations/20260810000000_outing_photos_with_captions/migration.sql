-- Migration: outing_photos_with_captions
-- Created: 2026-08-10
-- Convert outingPhotos from text[] to jsonb so each photo carries its own caption.
-- Storage shape: [{ url: string, caption?: string }, ...]
--
-- Existing rows (if any) are coerced via COALESCE+to_jsonb so the migration
-- is safe in dev/prod. As of writing this migration, no production rows
-- have outingPhotos set.
--
-- (Schema migration applied directly via pg driver before this file
-- existed — see prior session notes about Neon advisory-lock timeouts.)
-- To re-run cleanly, drop the default first, cast, then re-set the default.

ALTER TABLE "GuestPost" ALTER COLUMN "outingPhotos" DROP DEFAULT;
ALTER TABLE "GuestPost"
  ALTER COLUMN "outingPhotos" SET DATA TYPE jsonb
  USING COALESCE(to_jsonb("outingPhotos"), '[]'::jsonb);
ALTER TABLE "GuestPost" ALTER COLUMN "outingPhotos" SET DEFAULT '[]'::jsonb;
