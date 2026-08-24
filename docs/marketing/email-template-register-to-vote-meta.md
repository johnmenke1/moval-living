# Email Template — `Register to Vote — Email 1` — GHL metadata

This is the GHL-side metadata for the email template in
`docs/marketing/email-template-register-to-vote.html`. When you paste
the HTML into the GHL Email Builder, fill in the fields below.

## Template basics

| Field | Value |
|---|---|
| Template name | `Register to Vote — Email 1` |
| Template type | Marketing |
| Subject line | `One small thing — set a password so you can vote` |
| Preview text (the snippet after the subject in inbox) | `Takes 20 seconds, your info is already filled in from your nomination.` |
| From name | `Emma from moval.living` |
| From email | the same sender used for the Best-Of thank-you email (currently `MovalLiving <noreply@moval.living>` per `src/lib/best-of-nominations.ts`). **Match this exactly.** Different `From:` addresses between transactional (thank-you) and marketing (this) emails lower deliverability. |
| Reply-to | the same address used for replies to the thank-you / claim emails today. If there's no reply-to monitoring, set to `noreply@moval.living` and explicitly say so in the workflow. |
| Track opens | yes |
| Track clicks | yes |
| Plain-text fallback | (recommended) — GHL can auto-generate a plain-text version, or paste a manual one. The plain-text version lives in this same file under [Plain-text fallback]. |

## Merge fields used in the HTML

The HTML uses these GHL contact merge fields:

| Variable in HTML | GHL merge field | Notes |
|---|---|---|
| `{{contact.first_name}}` | `{{contact.first_name}}` | Greeting + register URL |
| `{{contact.last_name}}` | `{{contact.last_name}}` | Register URL pre-fill |
| `{{contact.email}}` | `{{contact.email}}` | Register URL pre-fill |

The register URL **does NOT include `nominationId`** (unlike the
inline-CTA URL on the post-submit page, which does). GHL doesn't
have access to the BestOfNomination.id — that lives in our Postgres
DB. Going through GHL means the nomination stays linked via:
  1. The contact's `community-member` + `nominee-no-account` tags
     (we know this contact came from a nomination).
  2. The companion workflow removes the `nominee-no-account` tag
     when `moval-living-opt-in` is added.
This is good enough for the registration-conversion signal. The
local-DB-to-GHL-tag consistency is approximate, not transactional.

Optional — the `nomination.business_name` and `nomination.category_name` merge fields would make the email more personal ("you nominated Taqueria 2 Potrillos for Best Tacos"). To enable them, we'd add two **contact custom fields** (`Best Of Nomination: Business Name`, `Best Of Nomination: Category Name`) populated by `syncNominatorToGHL()` at nomination time. We don't add those today; the email stays generic on business name. **Recommended:** keep it generic for the first version; if conversion is low, add the custom fields later.

## When this template fires

In the workflow `MoVal Nominee → Register to Vote` (full spec in
`docs/marketing/ghl-nominee-no-account-workflow.md`):

- Trigger: contact tag added → `nominee-no-account`
- After 2 hour wait
- Branch: contact also has tag `moval-living-opt-in`
- Step: send this template

## Plain-text fallback

For inbox clients that don't render HTML, GHL's auto-stripper
produces this from the HTML above. You can paste this in explicitly
for cleaner fallback rendering:

```
Hi {{contact.first_name}},

A couple hours ago you nominated a local business for our Best Of MoVal list — thanks again for that, it really is what makes this directory work.

One small thing: when the categories open, you'll be able to vote on the Best Of picks — but only if you have a moval.living account. Setting one up takes about 20 seconds: just a password, and your email and name are already filled in from your nomination.

Set a password to vote:
https://www.moval.living/register?name={{contact.first_name}}%20{{contact.last_name}}&email={{contact.email}}&returnTo=%2Fbest-of

If you'd rather not create an account right now, that's totally fine — your nomination is already in. We'll let you know when the editors are ready to start voting.

Cheers,
Emma
moval.living — Moreno Valley's Community Business Directory

---
You received this because you submitted a Best Of nomination on moval.living and opted in to receive updates. If you'd like to stop receiving these messages, reply "unsubscribe" and we'll take you off the list.
moval.living
```

## Notes for the GHL AI Agent

- The HTML is paste-ready. No CSS frameworks, no external assets, no
  scripts. It should render identically in Gmail, Outlook, Apple Mail.
- The merge fields above are stock GHL contact fields. No custom
  contact fields are required.
- The register URL uses URL-encoded spaces (`%20`) between first and
  last name. Don't replace with `+` — our `/register` form handles
  `+` as a literal plus, not as a space.
- Test the link in a real inbox before going live. The most common
  deliverability failure is a malformed URL.
