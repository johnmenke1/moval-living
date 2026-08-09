-- Add consent fields for CAN-SPAM / 10DLC compliance
-- emailOptIn: explicit opt-in for marketing emails (required for 10DLC + TCPA)
-- smsOptIn: explicit opt-in for SMS (currently unused, but reserved for future use)
-- smsConsentAt: timestamp of consent (required for 10DLC audit trail)
-- emailConsentAt: timestamp of email opt-in
ALTER TABLE "Owner" ADD COLUMN "emailOptIn"      BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE "Owner" ADD COLUMN "smsOptIn"        BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE "Owner" ADD COLUMN "emailConsentAt"  TIMESTAMP(3);
ALTER TABLE "Owner" ADD COLUMN "smsConsentAt"    TIMESTAMP(3);
ALTER TABLE "Owner" ADD COLUMN "smsConsentSource" TEXT; -- e.g. 'claim-form', 'submit-form', 'landing-page'
ALTER TABLE "Owner" ADD COLUMN "phone"           TEXT; -- optional phone for SMS opt-in (future)
