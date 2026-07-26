# GHL Workflow Setup Guide — moval.living Business Outreach

## Overview
This workflow automates outreach to businesses on moval.living. It enrolls contacts when we add the tag `moval-invite-sent`, sends a 6-step email sequence, branches based on opens/clicks, and pivots to website services for businesses without a website.

---

## Prerequisites
1. GoHighLevel account with API access
2. Sub-account created for moval.living
3. API Key: GHL → Settings → API Keys → Create (`moval-outreach`)
4. Location ID: GHL → Settings → Business Information → copy Location ID
5. Email sending enabled on your GHL sub-account (Settings → Email → enable sending)

---

## Step 1 — Create the Workflow

1. **GHL → Marketing → Workflows → New Workflow**
2. Name: `moval.living Business Outreach`
3. Description: `Automated outreach sequence for new moval.living directory listings`
4. Click **Create Workflow**

---

## Step 2 — Set the Trigger

**Trigger type:** Contact Tag Added

- Tag: `moval-invite-sent`

> The outreach script applies this tag when it creates/updates each contact in GHL. This is what kicks off the workflow.

---

## Step 3 — Email #1 (Initial Invite)

**Action:** Send Email

| Field | Value |
|-------|-------|
| To | {{contact.email}} |
| From | Emma@moval.living |
| Reply-To | emma@moval.living |
| Subject | Is {{contact.business_name}} on moval.living? |

> **Template:** `emails/01-invite-initial.md`
> Replace: `{{business_name}}`, `{{first_name}}`, `{{listing_url}}`, `{{claim_url}}`

**Wait:** 3 days before next step

---

## Step 4 — Split: Opened vs. Not Opened

**Action:** If/Else branch

Condition:
- If `Email #1 opened = Yes` → Branch A
- If `Email #1 opened = No` → Branch B

> GHL tracks opens automatically when email is sent through GHL.

---

## Step 5A — Follow-Up (Opened, No Click)

**Action:** Send Email

| Field | Value |
|-------|-------|
| Subject | Quick question about {{contact.business_name}} |

> **Template:** `emails/02-followup-opened.md`

**Wait:** 3 days

---

## Step 5B — Follow-Up (Not Opened)

**Action:** Send Email

| Field | Value |
|-------|-------|
| Subject | {{contact.business_name}} — your listing is waiting |

> **Template:** `emails/03-followup-unopened.md`

**Wait:** 4 days

---

## Step 6 — Re-Engagement + Website Services Angle

**Action:** Send Email

| Field | Value |
|-------|-------|
| Subject | Is your business easy to find online? |

> **Template:** `emails/04-reengagement.md`
> Note: This email plants the seed about website services for ALL contacts.

**Wait:** 3 days

---

## Step 7 — Split: Has Website vs. No Website

**Action:** If/Else branch based on tag

| Tag | Branch |
|-----|--------|
| `has-website` | Website services skip — go to referral nurture |
| `no-website` | Continue to website pitch |

> The outreach script tags contacts with `has-website` or `no-website` based on whether the `website` field is populated in moval.living.

---

## Step 8A — Website Pitch (No Website Tag)

**Action:** Send Email

| Field | Value |
|-------|-------|
| Subject | Free website audit for {{contact.business_name}} |

> **Template:** `emails/05-no-website-pitch.md`

**Wait:** 5 days

---

## Step 8B — Referral Nurture (Has Website Tag)

**Action:** Send Email (referral ask)

> Optional: Ask them to refer other businesses or leave a review.

---

## Step 9 — Last Chance Email

**Action:** Send Email

| Field | Value |
|-------|-------|
| Subject | Last call — {{contact.business_name}} on moval.living |

> **Template:** `emails/06-last-chance.md`

**Wait:** 2 days

---

## Step 10 — Add Tag `moval-outreach-complete` + End

**Action:** Add Contact Tag: `moval-outreach-complete`

> Prevents re-enrollment. The script will skip contacts with this tag.

---

## Tags Reference (used by the script)

| Tag | Meaning |
|-----|---------|
| `moval-invite-sent` | Initial outreach sent — triggers workflow |
| `moval-followup-1-sent` | First follow-up sent |
| `moval-no-website` | Business has no website → website pitch sequence |
| `moval-has-website` | Business has a website → skip pitch |
| `moval-verified` | Contact claimed/verified their listing |
| `moval-outreach-complete` | Full sequence done — skip on future runs |
| `moval-outreach-suppressed` | Opted out or replied — stop all outreach |

---

## GHL Custom Fields to Create

Create these in **GHL → Settings → Custom Fields**:

| Field Name | Type | Notes |
|------------|------|-------|
| moval_listing_url | Text | URL to their listing on moval.living |
| moval_claim_url | Text | Direct claim/verify link |
| moval_city | Text | City (Moreno Valley) |
| moval_outreach_date | Date | Date outreach was initiated |
| moval_has_website | Checkbox | Yes = has website, No = no website |
| moval_ghl_contact_id | Text | Internal — stores GHL contact ID on the Business record in Neon |

---

## API Script (`scripts/ghl-outreach.js`)

The companion script will:
1. Query Neon: `SELECT * FROM "Business" WHERE email IS NOT NULL AND email != '' AND status = 'APPROVED' AND ("ghlContactId" IS NULL OR "ghlContactId" = '')`
2. For each business without a GHL contact ID:
   - Create GHL contact via `POST /contacts/v2/`
   - Apply tag `moval-invite-sent`
   - Apply tag `moval-no-website` or `moval-has-website`
   - Store returned GHL contact ID as `ghlContactId` on the Business record
3. Skip businesses with `moval-outreach-complete` or `moval-outreach-suppressed` tags

Run it once to seed all contacts into GHL and kick off the workflow for each.

---

## Environment Variables Needed

Add to Vercel env vars (and `.env.local` for local dev):

```
GHL_API_KEY=            # Your GHL API key
GHL_LOCATION_ID=        # Your GHL Location ID (UUID)
GHL_BASE_URL=https://services.leadconnectorhq.com
```

The outreach script also reads these from `.env.local`.
