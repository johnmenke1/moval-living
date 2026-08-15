-- Add fields to capture the original Instagram post data more thoroughly
-- and to store our proxied/generated hero image on the CDN.

ALTER TABLE "Submission"
  -- The original Instagram caption text (separate from submitterNote so admin
  -- notes and post content don't get conflated)
  ADD COLUMN "sourcePostCaption" TEXT,

  -- Our CDN URL for the hero image — the URL we actually serve on /events.
  -- Populated by scripts/generate-event-poster.mts after Playwright fetches
  -- the source og:image (which IG CDN auth-gates) and fal generates a
  -- replacement, or by a Puppeteer proxy if we ever add one.
  ADD COLUMN "thumbnailUrl" TEXT;

-- index on sourcePostCaption is not needed (full-text search would be a future
-- optimization); thumbnailUrl is rarely queried.
