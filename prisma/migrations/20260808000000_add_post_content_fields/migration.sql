-- Migration: add_post_content_fields
-- Created: 2026-08-08
-- Adds content fields per post type:
--   faqItems       — JSON array for Guest Expert posts (Question久留 Answer)
--   outingPhotos   — string array of photo URLs for Live Curiously outings
--   youtubeVideoId — YouTube video ID for Outing and Spotlight posts

BEGIN;

ALTER TABLE "GuestPost"
  ADD COLUMN IF NOT EXISTS "faqItems" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "outingPhotos" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "youtubeVideoId" TEXT;

-- Sample FAQ shape (stored as JSON array):
-- [
--   { "question": "What is...", "answer": "..." },
--   ...
-- ]

-- Sample outingPhotos: ARRAY['https://...', 'https://...']

-- Sample youtubeVideoId: 'dQw4w9WgXcQ' (from youtube.com/watch?v=dQw4w9WgXcQ)

COMMIT;
