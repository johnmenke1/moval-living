# GHL Workflow — `Nominee No Account → Register to Vote`

This is the spec to hand to the **GHL AI Agent** (or paste into the
manual workflow builder) so it can create the follow-up workflow that
nudges Best-Of nominators who submitted without an account to come back
and register so they can vote.

## Context

- **Where the trigger comes from:** the public Best-Of nomination form
  at `https://www.moval.living/submit/best-of`.
- **What fires the workflow:** every nominator who submits without an
  active session gets a new GHL tag, `nominee-no-account`. The tag is
  applied automatically by `src/lib/best-of-nominations.ts`
  `syncNominatorToGHL()` (called from
  `src/app/api/best-of/nominations/route.ts`).
- **Where the URL lives:** the workflow is free to use any URL, but
  the canonical register URL with pre-filled name + email is
  `https://www.moval.living/register?name={{contact.first_name}}%20{{contact.last_name}}&email={{contact.email}}&returnTo=%2Fbest-of`.
  This lands the user on `/register` with the name + email fields
  pre-populated; they only need a password.
- **Why now:** the registration nudge on the post-submit page is the
  primary path, but only ~30% of users take it inline (rough estimate).
  The rest bounce. This workflow catches them.

## Success Metric

- **Primary:** the percentage of `nominee-no-account` contacts who
  register within 30 days (target: 15–25%).
- **Secondary:** GHL's "Opens" + "Clicks" on email 1 (sanity-check
  the subject line is working).
- **Cleanup signal:** when a contact later registers, our `/register`
  flow does NOT auto-remove the tag (we don't have GHL access on the
  Next.js side). The tag should be removed by a separate companion
  workflow that watches for `community-member`-only contacts who
  were also recently tagged `moval-living-opt-in` — see "Companion
  Workflow" below.

## Tag Map (additions / changes)

| Tag | Meaning | Applied by | Removed by |
|---|---|---|---|
| `nominee-no-account` | Contact submitted a Best-Of nomination without being signed in | `src/lib/best-of-nominations.ts` (every nomination) | Companion workflow (see below) |
| `moval-living-opt-in` | (existing) Contact opted in to marketing at claim / register time | `src/app/claim/complete/page.tsx`, register flow | (never removed automatically) |

The `community-member` tag is applied to every nominated contact (logged-in or not) by the same `syncNominatorToGHL()` call — that's the broader signal that *this person is engaged with the Best-Of process*, while `nominee-no-account` is the narrower signal that they didn't yet convert to an account.

---

## Workflow Specification

**Workflow name:** `MoVal Nominee → Register to Vote`

**Trigger:** Contact tag added → `nominee-no-account`

### Step 1 — Wait 2 hours

- **Action:** Wait / Delay
- **Duration:** 2 hours
- **Rationale:** the inline CTA on the success page is the primary path.
  Two hours is enough to catch the fast-clickers; anything beyond that
  is the bounced / distracted cohort we actually want to email.

### Step 2 — Branch on `moval-living-opt-in`

- **Action:** If/Else condition
- **Branch A (yes — opted in):** proceed to Step 3.
- **Branch B (no — not opted in):** proceed to Step 4.
- **Rationale:** CAN-SPAM / 10DLC compliance. We only email people who
  consented to marketing. The opt-in flag is set on contact creation
  if the nominator checked the "Send me moval.living news & updates"
  box on the form (mirrored from `BestOfNomination.emailOptIn`).
  Nominators who didn't check that box still get the GHL contact
  created (so we can recognize them when they re-visit), but we don't
  email them marketing — they go to the "no-email" branch and we wait
  for them to come back via another opt-in path (claim, register, etc.).

### Step 3 — Email 1 (opt-in branch only): "Thanks for the nomination — set a password to vote"

- **Action:** Send Email
- **Template:** `Register to Vote — Email 1` (the template spec lives
  in `docs/marketing/email-template-register-to-vote.html` for the
  raw HTML + `docs/marketing/email-template-register-to-vote-meta.md`
  for the GHL-side template metadata — Subject, Preview, From Name).
- **From name:** `Emma from moval.living`
- **From email:** the same `noreply@moval.living` (or whatever
  sender is currently verified for marketing in GHL; match the
  thank-you email's sender exactly).
- **Merge fields used:**
  - `{{contact.first_name}}` — greeting
  - `{{contact.email}}` — pre-fill on the register URL
  - `{{contact.last_name}}` — combined into the name merge for the
    register pre-fill (or use a custom field if GHL has one)
- **Send time:** send immediately after the 2-hour wait (no extra
  hour-of-day filter — they're warm).

### Step 5 — Wait 3 days, then conditional Email 2

- **Action:** Wait / Delay → 3 days
- **Rationale:** Gmail inbox rotation means email 1 might land in
  Promotions / Spam on the first pass. Three days lets us re-attempt
  without being aggressive.

### Step 6 — Branch: did they register yet?

- **Action:** If/Else on
  Condition: Contact **does NOT have** tag `community-member` AND
  `created_at` was >= 7 days ago... no wait. Cleaner check:
  **does NOT have** the custom field `MoVal Living: Account Created`
  populated. We don't have that field today (see "Open Questions"
  below), so the practical proxy for now is **does NOT have** any
  Owner-record linkage we can detect from GHL.
- **Branch A (yes — still doesn't have an account):** proceed to
  Step 7 (Email 2).
- **Branch B (no — has an account):** end workflow (the contact is
  a real user now; the companion workflow will remove the tag).

### Step 7 — Email 2 (still-no-account branch only): "One more thing — vote on the Best-Of"

- **Action:** Send Email
- **Tone:** slightly more direct than email 1, but still warm. Frame
  it as "the categories are open for voting" rather than "you should
  have done this yesterday."
- **Content outline:**
  - Hi {{first_name}}, quick follow-up on the nomination.
  - The categories you nominated are now in the running for votes.
  - Voting takes 30 seconds and only requires that you set a password.
  - Big colorful button → same register URL with pre-fill.
  - Sign off the same way as email 1.

### Step 8 — Wait 7 days, then end

- **Action:** Wait / Delay → 7 days
- **Action:** End workflow
- **Rationale:** we don't email a third time. Three emails in 10 days
  is the practical spam threshold for a non-transactional nudge.
  Anyone who didn't convert by email 2 isn't going to convert via
  more emails; they need to come back via another touchpoint (e.g.
  seeing the Best-Of winners announcement and wanting to vote next
  round).

---

## Companion Workflow — Remove `nominee-no-account` on register

**Workflow name:** `MoVal Nominee → Clear No-Account Tag on Register`

**Trigger:** Contact tag added → `moval-living-opt-in` AND contact has tag `nominee-no-account`

Or simpler: any time `moval-living-opt-in` is added (which happens at registration), check for `nominee-no-account` and remove it.

**Action:** Remove tag `nominee-no-account`

**Why a separate workflow:** keeps the trigger narrow. We don't want
to remove `nominee-no-account` from people who got tagged via some
other path (currently there's only one — the nomination form — so
this could be a single workflow, but separating them is cleaner for
the GHL UI).

**Implementation note for the GHL AI Agent:** if you can't easily
express "tag removed when another tag is added," the cleanest pattern
is to add a custom field on the contact called "MoVal Living: Account
Created" with value `true`, set by GHL when the contact records the
opt-in tag. Then the main workflow's "Branch: did they register yet?"
becomes "Branch: Account Created = true" which is reliable.

---

## Open Questions for Johnny

- **The "did they register" signal.** Right now we don't have a clean
  way for the second-email branch to know if a contact went on to
  create an account. The cleanest answer is a custom contact field
  (`MoVal Living: Account Created`) updated by our `/register` flow —
  but our Next.js code doesn't write to GHL on register today. If we
  want the branch to work reliably, we'd add a single GHL API call to
  `/api/auth/register` (one new line: `void markGhlAccountCreated(contact.email)`).
  **Recommended:** ship this workflow with the proxy check (no
  `community-member` + is in this cohort) for now and add the custom-
  field update later if we want to harden it.

- **The email templates.** The HTML for email 1 is in
  `docs/marketing/email-template-register-to-vote.html` — that's a
  paste-ready GHL custom-HTML email template. The GHL-side
  metadata (subject, preview text, from name, merge field
  declarations) is in `docs/marketing/email-template-register-to-vote-meta.md`.

- **Email 2 content.** I wrote the structural outline in Step 7
  above. The full HTML for email 2 can mirror email 1's template —
  the styling is identical, just different copy. **Easy to add if
  the AI agent wants a second raw-HTML file.**

---

## Hand-off to the GHL AI Agent — short version

> "Create a new workflow in GoHighLevel called `MoVal Nominee →
> Register to Vote`. Trigger: contact tag added → `nominee-no-account`.
> Wait 2 hours. If the contact also has tag `moval-living-opt-in`,
> send the email template `Register to Vote — Email 1` (paste the HTML
> from `docs/marketing/email-template-register-to-vote.html`). Wait 3
> days. If the contact still does not have a `MoVal Living: Account
> Created` custom field populated, send Email 2. Wait 7 days. End
> workflow. Also create a companion workflow that removes the
> `nominee-no-account` tag when `moval-living-opt-in` is added."