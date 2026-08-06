-- Migration: allow_null_author_and_auto_updatedat
-- Created: 2026-08-09
-- Brings production schema in sync with the model:
-- 1. authorId is optional (LIFE/OUTING/SPOTLIGHT posts have no guest author).
--    Previous schema declared it NOT NULL, which blocked any non-GUEST post create.
-- 2. updatedAt needs a default value, since Prisma's `@updatedAt` only fires
--    on subsequent UPDATEs — the first row has no previous row to reference.
--
-- (Schema-to-DB drift accumulated after `prisma migrate deploy` silently
-- failed with advisory-lock timeouts on Neon a few sessions ago. This
-- migration only records the current state — ALTERs were applied directly
-- against the database via the pg driver before this file existed.)

ALTER TABLE "GuestPost" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "GuestPost" ALTER COLUMN "updatedAt" SET DEFAULT now();
