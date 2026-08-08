-- Migration: add_business_audit
-- Adds BusinessAudit table for re-audit history of business websites.
-- Signal sources: direct HEAD/GET probes + Tavily Extract.
-- Drives: admin diagnostics, public health badge, GHL mirror.

-- CreateTable
CREATE TABLE "BusinessAudit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "httpStatus" INTEGER,
    "finalUrl" TEXT,
    "error" TEXT,
    "pageLoadMs" INTEGER,
    "contentLength" INTEGER,

    -- Infrastructure
    "hasSsl" BOOLEAN NOT NULL DEFAULT false,
    "isMobileFriendly" BOOLEAN NOT NULL DEFAULT false,
    "siteLoads" BOOLEAN NOT NULL DEFAULT false,

    -- SEO
    "hasTitle" BOOLEAN NOT NULL DEFAULT false,
    "hasMetaDescription" BOOLEAN NOT NULL DEFAULT false,
    "hasSingleH1" BOOLEAN NOT NULL DEFAULT false,
    "hasSitemap" BOOLEAN NOT NULL DEFAULT false,
    "hasRobotsTxt" BOOLEAN NOT NULL DEFAULT false,
    "hasSchemaOrg" BOOLEAN NOT NULL DEFAULT false,
    "hasOpenGraph" BOOLEAN NOT NULL DEFAULT false,
    "hasAltTextCoverage" BOOLEAN NOT NULL DEFAULT false,

    -- Conversion
    "hasContactForm" BOOLEAN NOT NULL DEFAULT false,
    "hasVisibleEmail" BOOLEAN NOT NULL DEFAULT false,
    "foundEmail" TEXT,
    "foundPhone" TEXT,

    -- Analytics
    "hasGoogleAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "hasGoogleTagManager" BOOLEAN NOT NULL DEFAULT false,
    "hasMetaPixel" BOOLEAN NOT NULL DEFAULT false,

    -- Freshness
    "copyrightYear" INTEGER,
    "hasDeprecatedHtml" BOOLEAN NOT NULL DEFAULT false,
    "hasBlog" BOOLEAN NOT NULL DEFAULT false,

    -- Composite
    "score" INTEGER NOT NULL DEFAULT 0,

    -- Source data
    "rawHtml" TEXT,
    "rawSignals" JSONB,

    CONSTRAINT "BusinessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessAudit_businessId_idx" ON "BusinessAudit"("businessId");
CREATE INDEX "BusinessAudit_score_idx" ON "BusinessAudit"("score");
CREATE INDEX "BusinessAudit_auditedAt_idx" ON "BusinessAudit"("auditedAt");

-- AddForeignKey
ALTER TABLE "BusinessAudit" ADD CONSTRAINT "BusinessAudit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;