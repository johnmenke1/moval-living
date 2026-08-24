-- Email-change confirmation flow.
--
-- Adds EmailChangeRequest: a pending request from an Owner to swap
-- their email to a new address. The flow is:
--
--   1. POST /api/profile/email-change/request
--      - Owner is signed in (401 if not)
--      - Body: { newEmail }
--      - We generate a 32-byte random token, base64url-encode it,
--        store the row, send an SES email to newEmail with a link.
--      - Any prior pending request for the same Owner is invalidated
--        (we delete those rows before issuing the new one).
--
--   2. GET /api/profile/email-change/confirm?token=...
--      - Looks up the row by token.
--      - 400 if token malformed.
--      - 410 if expired or already used.
--      - On success: marks usedAt = NOW(), swaps Owner.email to
--        newEmail, returns redirect to /dashboard/profile.
--
-- onDelete: Cascade on owner — if the Owner account is deleted, all
-- pending email-change requests for it are deleted too. No
-- dangling-token risk.
--
-- Token is unique so the lookup is indexed.

CREATE TABLE "EmailChangeRequest" (
  "id"        TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  "newEmail"  TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "EmailChangeRequest_token_key" ON "EmailChangeRequest"("token");
CREATE INDEX "EmailChangeRequest_ownerId_idx" ON "EmailChangeRequest"("ownerId");
CREATE INDEX "EmailChangeRequest_expiresAt_idx" ON "EmailChangeRequest"("expiresAt");

ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "EmailChangeRequest_ownerId_fk"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;