-- Migration: add_post_types
-- Created: 2026-08-07
-- Four post types:
--   LIFE       = "Life in MoVal" — John's voice, his observations (no GuestAuthor)
--   GUEST      = Guest expert post (requires GuestAuthor)
--   OUTING     = Live Curiously outing photo-essay (no GuestAuthor)
--   SPOTLIGHT  = Business video short (optional GuestAuthor)
-- Existing GuestPost rows get postType='GUEST' as a safe default.

-- 1. Add postType column as text first (avoids enum cast issues in PostgreSQL)
ALTER TABLE "GuestPost" ADD COLUMN "postType" TEXT NOT NULL DEFAULT 'GUEST';

-- 2. Add check constraint to enforce valid values
ALTER TABLE "GuestPost" ADD CONSTRAINT "GuestPost_postType_check"
  CHECK ("postType" IN ('LIFE', 'GUEST', 'OUTING', 'SPOTLIGHT'));

-- 3. Add index for filtering by postType
CREATE INDEX "GuestPost_postType_idx" ON "GuestPost"("postType");
