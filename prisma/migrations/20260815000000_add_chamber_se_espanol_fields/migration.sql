-- Add "Se Habla Español" + Chamber affiliation fields to Business.
--   seHablaEspanol         owner-toggleable in claim flow + dashboard edit
--   chamberMember          Moreno Valley Chamber of Commerce — admin-only
--   hispanicChamberMember  Moreno Valley Hispanic Chamber of Commerce — admin-only
--
-- These surface as badges on business listing cards and the public
-- /business/[slug] page. All default to false so existing rows are
-- unaffected; no backfill is needed.
ALTER TABLE "Business" ADD COLUMN "seHablaEspanol"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "chamberMember"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "hispanicChamberMember" BOOLEAN NOT NULL DEFAULT false;