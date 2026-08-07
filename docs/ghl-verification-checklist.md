# GHL Integration — Verification Checklist

Use this after deploying the GHL setup + env vars to confirm everything
end-to-end before promoting a partner publicly.

## Pre-flight (Vercel env vars)

```bash
# Confirm env vars are set on the production deployment
vercel env ls --prod | grep -E 'GHL_|STRIPE_PRICE_EXPERT'
```

Expected output:
```
GHL_API_KEY              (Production)
GHL_LOCATION_ID          (Production)
GHL_PIPELINE_ID          (Production)   ← must be set
GHL_PIPELINE_STAGE_ID    (Production)   ← must be set
GHL_WORKFLOW_ID          (Production)   ← must be set
STRIPE_PRICE_EXPERT_MONTHLY  (Production)
STRIPE_PRICE_EXPERT_YEARLY   (Production)
```

## Test 1 — Lead form end-to-end (manual)

1. Go to `/dashboard` → pick any approved business → expand the moderation panel → set tier to **Expert Partner ✨** → save → set `expertPartnerSlug` to `test-partner` → save.
2. Visit `/partners/test-partner` in an incognito window.
3. Fill out the lead form with a real-looking email. Submit.
4. Within ~3 seconds:

   **In Vercel logs:**
   ```
   [Partner Lead] Cached ghlCompanyId <id> for <business name>
   ```
   (Only on first lead — subsequent ones don't show this.)

5. **In GHL:**

   **Companies tab:**
   - Find company matching business name → tagged `expert-partner` ✓

   **Contacts tab:**
   - Find new contact with email you submitted → tagged `movalliving-lead` ✓
   - Custom field `movalliving_lead_id` populated ✓
   - Custom field `lead_message` populated with what you typed ✓
   - Custom field `partner_slug` = `test-partner` ✓
   - Contact is linked to the Company (click into it, see "Company" field) ✓

   **Opportunities tab:**
   - New opportunity in "Expert Partner Leads" pipeline, "New Lead" stage ✓
   - Opportunity is linked to the contact ✓

   **Workflows:**
   - Workflow 1 history shows it ran for this contact ✓
   - You (Johnny) got an email with the lead details ✓
   - Partner got a "new lead" email ✓

## Test 2 — Workflow 2 (24h reminder)

This is harder to test because it fires 24h later. Two options:

**Option A (patient):** Wait 24h. Check the Tasks tab in GHL — there
should be a task assigned to you: "Follow up with [partner] on lead [name]".

**Option B (fast):** Manually create a test Opportunity in New Lead
stage. Wait 24h (or temporarily lower the wait to 5 minutes for testing,
then change back).

## Test 3 — Workflow 3 (Founding Partner)

Manually add the `founding-partner` tag to your test Company.

Within seconds:
- Partner gets the "Welcome, Founding Partner" email
- You get a task: "Schedule first interview with [Partner]"

Remove the tag after testing so you don't pollute the contact's tag list.

## Test 4 — Failed API call gracefully degrades

Temporarily rename one of the GHL_* env vars to an invalid value in
Vercel (or set it to an empty string). Submit another lead.

Expected behavior:
- Lead still saves to our DB (you can verify with `psql` or `pg`)
- Lead still emails the partner via SES
- Vercel log shows `[Partner Lead] GHL error — ...` or `GHL skipped — ...`
- `/partners/[slug]` still 200s (the API returns `{ ok: true, leadId }`)

Restore the env var after testing.

## Test 5 — Spam protection

Submit the form 6 times in quick succession with the same IP.

Expected: 6th submission returns `429 Too Many Submissions`.

## Test 6 — Honeypot

Curl the API directly with a `website` field populated:

```bash
curl -X POST https://www.moval.living/api/partners/test-partner/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Bot","email":"bot@spam.com","message":"hi","website":"http://spam.com"}'
```

Expected: `{ ok: true }` with 200 status — but NO lead in our DB and NO
notification email sent.

## Cleanup

After all tests pass:

1. Remove the test partner flag from the business in admin.
2. Delete the test lead in GHL (and the test company if you don't want it).
3. Set tier back to FREE.
4. Re-deploy if you changed anything (Vercel env vars trigger a redeploy automatically).

## Going live

Once tests pass:

1. Pick your first real Expert Partner business.
2. Set tier to Expert Partner, set `expertPartnerSlug` to a clean slug.
3. Set `foundingPartnerSince` if they're a Founding Partner.
4. Verify `/partners/[slug]` looks right.
5. Share the link with the partner — they're live.

GHL will auto-create the Company on first lead (idempotent — safe to retry).