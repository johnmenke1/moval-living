# GHL Cold Outreach — System of Record

This is the GHL-driven outreach system for moval.living. **GHL is the source of
truth for unsubscribes, opt-outs, and the active conversation.** The moval DB
mirrors the state for our own use, but anyone wanting to check DND or
unsubscribe status should look at GHL.

## Tag Map

| Tag | Meaning | Applied by |
|---|---|---|
| `moval-living-cold-outreach` | Contact is in the cold outreach pool (unclaimed, got the intro email) | `scripts/outreach-cold.mts` |
| `moval-living-listing-claimed` | Owner successfully claimed their business listing | `src/app/claim/complete/page.tsx` (auto) + `scripts/claim-sync-ghl.mts` (manual) |
| `moval-living-opt-in` | Owner explicitly opted in to marketing emails (recorded at claim) | `claim-complete` page + `claim-sync-ghl.mts` |
| `moval-living-source-google` | Contact was imported from Google Places (vs. manual entry) | `outreach-cold.mts` |

## DND / Unsubscribe

- GHL handles email unsubscribes natively via the email footer link.
- When a recipient unsubscribes, GHL sets `dnd=true` on the contact.
- Our outreach script **does not check DND explicitly** — GHL's workflow
  engine skips DND contacts automatically before sending.
- The webhook `dndSettings` field is preserved per contact (email, SMS, etc.).

## GHL Workflow

You'll need to build this workflow once in the GHL UI.

**Workflow name:** `MoVal Cold Outreach`

**Trigger:** Contact tag added → `moval-living-cold-outreach`

**Steps:**

1. (Optional) Wait 1 minute — gives the contact time to be fully indexed
2. Send email → template `Claim Your Free Listing`
   - To: `{{contact.email}}`
   - From: `Emma@moval.living`
   - Subject: `Your free Moreno Valley business listing is ready to claim`
3. Wait 3 days
4. If/Else:
   - Condition: Contact has NOT been tagged `moval-living-listing-claimed`
   - True: Send email → template `Follow-up: Claim Your Free Listing`
   - False: End workflow
5. Wait 7 days
6. If/Else (same condition)
   - True: Send email → template `Last chance: Claim Your Free Listing`
   - False: End
7. End

**Email template contents:**

```html
<p>Hi {{contact.first_name}},</p>
<p>We've created a new Moreno Valley business directory and your
business <strong>{{contact.companyName}}</strong> is already listed.</p>
<p>Claiming your free listing lets you:</p>
<ul>
  <li>Update your photos, hours, and description</li>
  <li>Respond to customer reviews</li>
  <li>Get discovered by 215,000+ Moreno Valley residents</li>
</ul>
<p>
  <a href="https://moval.living/claim?slug={{contact.customField.business_slug}}"
     style="...">
    Claim Your Free Listing →
  </a>
</p>
<p>No thanks? <a href="{{unsubscribe_link}}">Unsubscribe</a></p>
```

(GHL injects the unsubscribe link automatically. The `{{contact.address}}`,
`{{contact.city}}`, etc. tokens are auto-populated.)

## Email Footer (CAN-SPAM compliance)

In **GHL → Settings → Email → Footer**, set:

```
moval.living
23110 Atlantic Circle, Suite F
Moreno Valley, CA 92553
```

This is auto-appended to every email. Both footer + unsubscribe link are
required by CAN-SPAM.

## Setup Checklist

- [ ] Create the 4 tags in GHL (manually, or via `outreach-cold.mts` which auto-creates)
- [ ] Set email footer with physical address (CAN-SPAM)
- [ ] Build the "MoVal Cold Outreach" workflow
- [ ] Author the 3 email templates (initial, follow-up, last chance)
- [ ] Run `npx tsx scripts/outreach-cold.mts --dry-run` to preview
- [ ] Run `npx tsx scripts/outreach-cold.mts --limit=10` to smoke test
- [ ] Run `npx tsx scripts/outreach-cold.mts` to push all 134 contacts
- [ ] Wait for GHL to fire the workflow (verify first email lands)
- [ ] Unsubscribe from your own test email to confirm DND works
- [ ] Run `npx tsx scripts/claim-sync-ghl.mts` to backfill any existing claims

## Scripts

| Script | Purpose |
|---|---|
| `scripts/outreach-cold.mts` | Push contacts to GHL with cold-outreach tag. Idempotent. |
| `scripts/claim-sync-ghl.mts` | Sync all owned businesses: add `listing-claimed` + `opt-in`, remove `cold-outreach`. |
| `scripts/sync-ghl.mts` | Push Businesses to GHL Companies (separate from Contacts — for the pipeline stage). |

## What GHL Owns (vs. What Moval Owns)

| Owned by GHL | Owned by Moval DB |
|---|---|
| Contact record, email, name, phone | Business listing (name, slug, address, hours) |
| Tags (cold-outreach, listing-claimed, opt-in) | Audit scores |
| DND / unsubscribe state | Internal consent timestamps (audit trail) |
| Email thread history | Photos, descriptions, reviews |
| Workflow execution | Stripe subscriptions |
| Campaign analytics | |

Source of truth: **GHL for outreach + DND, Moval for everything else.**
