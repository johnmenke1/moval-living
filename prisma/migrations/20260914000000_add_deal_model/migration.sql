-- Create the Deal table (first-class promotion of the legacy
-- Business.coupon Json blob). Each Business may have many deals; each
-- deal carries its own image (Vercel Blob URL on imageUrl), promo copy,
-- optional code, optional date window, and an isActive flag so admin
-- can pull a deal off the index without deleting the row.
--
-- The legacy Business.coupon Json column and Business.hasCoupon bool
-- are intentionally LEFT IN PLACE. They stay in the schema for one
-- migration cycle so any stale reads continue to work; PUT
-- /api/businesses/[slug] mirrors legacy payloads into Deal rows. A
-- follow-up migration will drop the legacy columns after the data is
-- verified clean.

CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "imageUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- Foreign key with CASCADE delete: when the parent Business is removed,
-- all of its deals go with it. Matches the Business.reviews cascade
-- pattern (see migration 20260823023744_add_review_owner_id).
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
--
-- (businessId, isActive, displayOrder) supports the dashboard listing
-- inside /dashboard/deals and the admin Deals tab in
-- /dashboard/edit?id=..., both of which filter by businessId + isActive
-- and order by displayOrder.
CREATE INDEX "Deal_businessId_isActive_displayOrder_idx"
    ON "Deal"("businessId", "isActive", "displayOrder");

-- (isActive, expiresAt) supports the public /deals index, which
-- filters isActive=true and applies an expiresAt IS NULL OR
-- expiresAt > NOW() predicate. A composite index here makes the
-- filter+sort O(log n + matches) instead of a full scan.
CREATE INDEX "Deal_isActive_expiresAt_idx"
    ON "Deal"("isActive", "expiresAt");

-- (createdAt) supports the public /deals "newest" sort option.
CREATE INDEX "Deal_createdAt_idx"
    ON "Deal"("createdAt");

-- Backfill: one Deal row per non-null legacy Business.coupon Json blob.
-- Uses jsonb_extract_path_text to grab the known keys defensively (the
-- legacy column accepts arbitrary shape). isActive defaults to true
-- when the legacy coupon JSON is present (the Business.hasCoupon bool
-- was a separate, stale flag — see comment in the SELECT below). The
-- legacy coupon Json sometimes lacked 'headline'; for those rows we
-- fall back to a synthesized headline so the backfilled row is usable
-- in the dashboard immediately.
--
-- We do NOT use CROSS JOIN LATERAL here: both b."coupon" (the
-- Business column) and any LATERAL alias of the same name would be
-- visible at the same scope, and PostgreSQL refuses to resolve the
-- bare "coupon" reference. Instead we coerce non-object Json inline
-- with COALESCE + jsonb_typeof.
INSERT INTO "Deal" (
    "id",
    "businessId",
    "headline",
    "description",
    "code",
    "imageUrl",
    "expiresAt",
    "displayOrder",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    b."id",
    COALESCE(
        NULLIF(TRIM(b."coupon"->>'headline'), ''),
        'Legacy deal'
    ) AS headline,
    NULLIF(b."coupon"->>'description', '') AS description,
    NULLIF(b."coupon"->>'code', '') AS code,
    NULLIF(b."coupon"->>'imageUrl', '') AS imageUrl,
    CASE
        WHEN b."coupon"->>'expiresAt' IS NOT NULL
            AND b."coupon"->>'expiresAt' <> ''
            AND (b."coupon"->>'expiresAt') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (b."coupon"->>'expiresAt')::timestamp
        ELSE NULL
    END AS expiresAt,
    0 AS displayOrder,
    -- A non-null legacy coupon Json blob means the business owner
    -- INTENDED to have a deal. The Business.hasCoupon bool was a
    -- separate (and in practice stale) flag — only 1/156 APPROVED
    -- businesses with coupon JSON actually had hasCoupon=true. We
    -- trust the JSON: if it's there, the deal is live by default;
    -- admin can flip isActive=false later if it needs to come down.
    true AS isActive,
    COALESCE(b."updatedAt", CURRENT_TIMESTAMP) AS createdAt,
    CURRENT_TIMESTAMP AS updatedAt
FROM "Business" b
WHERE b."coupon" IS NOT NULL
    -- Skip rows where the legacy column is the empty jsonb object
    -- (no actual data to migrate). We treat "{}" as "no coupon".
    -- Also defensively skip non-object JSON (a string, array, number,
    -- null, or boolean stored as Json) since jsonb_typeof on those
    -- would not return 'object'.
    AND jsonb_typeof(b."coupon"::jsonb) = 'object'
    AND b."coupon"::text <> '{}'
    -- Only migrate APPROVED businesses — PENDING/REJECTED listings
    -- shouldn't have a public deal anyway. Pending businesses can
    -- get a deal later via the dashboard flow.
    AND b."status" = 'APPROVED';
