# Email Template — `Register to Vote — Email 2` — GHL metadata

This is the GHL-side metadata for the email template in
`docs/marketing/email-template-register-to-vote-2.html`. When you
paste the HTML into the GHL Email Builder, fill in the fields
below.

## Template basics

| Field | Value |
|---|---|
| Template name | `Register to Vote — Email 2` |
| Template type | Marketing |
| Subject line | `Voting opens soon — your account's not set up yet` |
| Preview text (the snippet after the subject in inbox) | `Takes 20 seconds now so you're ready when voting opens. No scrambling day-of.` |
| From name | `Emma from moval.living` |
| From email | the same sender used for the Best-Of thank-you email + Email 1 of this sequence (currently `MovalLiving <noreply@moval.living>` per `src/lib/best-of-nominations.ts`). **Match exactly across all three transactional/marketing emails** — different `From:` addresses between them lower deliverability. |
| Reply-to | the same reply-to used for Email 1 + the thank-you / claim emails. |
| Track opens | yes |
| Track clicks | yes |
| Plain-text fallback | (recommended) — GHL can auto-generate a plain-text version, or paste a manual one. The plain-text version lives in this file under [Plain-text fallback]. |

## Merge fields used in the HTML

The HTML uses these GHL contact merge fields:

| Variable in HTML | GHL merge field | Notes |
|---|---|---|
| `{{contact.first_name}}` | `{{contact.first_name}}` | Greeting + register URL |
| `{{contact.last_name}}` | `{{contact.last_name}}` | Register URL pre-fill |
| `{{contact.email}}` | `{{contact.email}}` | Register URL pre-fill |

The register URL **does NOT include `nominationId`** — same reason
as Email 1: GHL doesn't have access to the BestOfNomination.id.
Linkage happens via GHL tags (`community-member` +
`nominee-no-account`), and the companion workflow strips
`nominee-no-account` when `moval-living-opt-in` is added.

## When this template fires

In the workflow `MoVal Nominee → Register to Vote` (full spec in
`docs/marketing/ghl-nominee-no-account-workflow.md`):

- Trigger: contact tag added → `nominee-no-account`
- After 2 hour wait + Email 1, then 3-day wait
- **Branch: contact does NOT have a populated `MoVal Living: Account Created` custom field** (proxy for "still hasn't registered")
- Step: send this template
- After this fires: 7-day wait, then end the workflow (we don't email again)

## Differences from Email 1

| Aspect | Email 1 | Email 2 |
|---|---|---|
| Timing | 2 hours after nomination | 3 days after Email 1 (~3-4 days after nomination) |
| Header label | "One small thing" | "What's coming" + "Why set up your account now" |
| Tone | Warm intro, light request | Slightly more direct (still warm, not pushy) |
| CTA copy | "Set a password to vote" | "Set up my account" (less about voting, more about being ready) |
| Opening | References the nomination as recent ("a couple hours ago") | References Email 1 implicitly ("a few days ago... quick follow-up") |
| Body framing | "When the categories open, you'll be able to vote" (futuristic) | "Voting is opening soon" + "ready on day one — no scrambling" (more concrete timeline framing) |
| Grace path | "If you'd rather not create an account right now, that's totally fine" | "We'll send you a separate note when voting actually opens" (sets up future touchpoint) |
| Reasoning | First ask — explain why it matters | Second ask — leverage their existing interest, anchor on timing |

## Plain-text fallback

```
Hi {{contact.first_name}},

Quick follow-up on the nomination you sent us a few days ago. Your pick is in the running — and voting is opening soon.

What's coming: once voting opens, locals get to weigh in on every category. The whole thing takes about 30 seconds per pick — and you'll need an account to cast a vote.

Why set up your account now: setting one up takes about 20 seconds: just a password, and your name and email are already filled in from your nomination. When voting opens, you'll be ready to go on day one — no scrambling the morning of.

Set up my account:
https://www.moval.living/register?name={{contact.first_name}}%20{{contact.last_name}}&email={{contact.email}}&returnTo=%2Fbest-of

We'll send you a separate note when voting actually opens so you don't miss it. This is just a head's-up so you can be ready.

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
  contact fields are required for Email 2 itself (the `MoVal Living:
  Account Created` custom field is only used in the BRANCH decision
  in the workflow that decides whether to send this template).
- The register URL uses URL-encoded spaces (`%20`) between first and
  last name. Don't replace with `+` — our `/register` form handles
  `+` as a literal plus, not as a space.
- Test the link in a real inbox before going live. The most common
  deliverability failure is a malformed URL.
- **Important:** verify the timing math. If the nomination comes in at
  midnight, Email 1 fires at 2am, Email 2 fires 3 days later. That's
  not a problem for delivery but if the user reads Email 2 first
  (e.g. Gmail delayed Email 1 to Promotions), the framing in
  Email 2's opening ("a few days ago... quick follow-up") will feel
  off. This is a known minor copy-brittleness; we accept it because
  it's unlikely users see Email 2 without Email 1 given the
  short-window timing.