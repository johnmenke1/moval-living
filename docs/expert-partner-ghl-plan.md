# Moreno Valley Expert Partner — GHL Pipeline + Workflow Plan

This is the design for the GHL side of the Expert Partner program. It's
designed for the **single MoVal.Living sub-account** v1 setup with your
Private Integration token.

I've written the full click-by-click guide as a reference doc (`ghl-setup-step-by-step.md` in this skill). This page is the quick overview — read it first.

---

## The Pipeline: "Expert Partner Leads"

| Stage | Meaning | What triggers it |
|---|---|---|
| New Lead | Just received via the form | API creates it here (Stage 1) |
| Contacted | Partner has acknowledged | You drag it manually |
| Qualified | Real opportunity | You drag it manually |
| Won | Became a customer | You drag it manually |
| Lost | Not a fit / wrong number / spam | You drag it manually |

GHL adds Won/Lost automatically. You only add the first 3.

**One pipeline, not one-per-partner.** Every Expert Partner lead ends up here so you can see your whole pipeline in one view. Company tags do the per-partner filtering in workflows.

---

## The Tags (3 total)

| Tag | Where applied | Purpose |
|---|---|---|
| `movalliving-lead` | Contact | Marks every lead from the form |
| `expert-partner` | Company | Marks the partner business |
| `founding-partner` | Company | Only set when you confirm a Founding Partner |

**The `expert-partner` tag is the workflow filter** — it scopes every workflow to just your Expert Partner companies.

---

## The Workflows (3 total)

### Workflow 1 — Lead Received (the big one)
**Fires:** Every time a new Contact is created (with the filter that their Company has the `expert-partner` tag)

**Does:**
1. Emails Johnny a full notification with all lead details (uses `{{business.name}}` for the partner business)
2. Creates an Opportunity in the Expert Partner Leads pipeline, New Lead stage
3. Waits 5 minutes (gives partner a head start)
4. Sends the partner an email at `{{business.email}}` saying "you have a new lead"

**Variable reminder:** Use `{{business.name}}`, `{{business.email}}`, `{{business.phone}}` for the partner business (these are standard Company fields, populated automatically). Use `{{contact.first_name}}`, `{{contact.email}}`, `{{contact.lead_message}}` for the lead. Custom fields like `{{contact.partner_slug}}` need to be created in GHL Settings first.

### Workflow 2 — Follow-Up Reminder
**Fires:** 24h after an Opportunity is created in New Lead stage

**Does:**
1. Waits 24 hours
2. Checks if the Opportunity is *still* in New Lead
3. If yes → creates a task assigned to Johnny: "Follow up with [Partner] on lead [Name]"
4. If no → does nothing (partner already moved it)

### Workflow 3 — Founding Partner Welcome
**Fires:** Manually, when you add the `founding-partner` tag to a Company

**Does:**
1. Sends the Founding Partner a special welcome email (their rate is locked forever)
2. Creates a task for Johnny: "Schedule first interview with [Partner]"

---

## The Custom Fields (3 total, on Contact object)

| Field name | API key | Type | What it carries |
|---|---|---|---|
| MoVal Lead ID | `movalliving_lead_id` | Single-line text | Our internal ExpertPartnerLead.id for cross-ref |
| Lead Message | `lead_message` | Multi-line text | First 500 chars of the visitor's message |
| Partner Slug | `partner_slug` | Single-line text | `/partners/[slug]` URL — tells you which page it came from |

The **API key** column is exact — case-sensitive, no spaces. If you rename it, our integration silently breaks. The form bit is what you see in the GHL UI.

---

## What you (Johnny) need to do

**About 20 minutes of clicking in GHL.**

1. **Custom Fields:** Settings → Custom Fields → Contact → add the 3 fields above. **Write down the exact API keys.**
2. **Pipeline:** Opportunities → Pipelines → Create "Expert Partner Leads". Add the 3 middle stages. **Capture the Pipeline ID + "New Lead" stage ID from the URL.**
3. **Tags:** Contacts → Tags → Create the 3 tags above.
4. **Workflow 1:** Automations → Create. Trigger = Contact Created. Filter = Company Tag contains `expert-partner`. Add the 4 actions. **Capture the Workflow ID.**
5. **Workflow 2:** Same pattern, but trigger = Opportunity Created (pipeline = Expert Partner Leads, stage = New Lead). Wait 24h, condition, task.
6. **Workflow 3:** Same pattern, but trigger = Company Tag Added (`founding-partner`). 2 actions.

7. **Vercel env vars:** Add `GHL_PIPELINE_ID`, `GHL_PIPELINE_STAGE_ID`, `GHL_WORKFLOW_ID` (and the two Stripe price IDs).

8. **Test:** Pick a Business in admin → set tier to Expert Partner → submit the form on `/partners/[slug]` → check Vercel logs + GHL for the lead.

---

## The full click-by-click is in the skill reference doc

I wrote `references/ghl-setup-step-by-step.md` with screenshots-worth-of-detail, exact variable names GHL uses ({{contact.first_name}}, etc.), and the testing checklist.

---

## What I'm NOT setting up

A few things I'd suggest deferring until you have paying partners:

- **GHL → moval.living webhook** (churn signals back to us). Build when you have your first 3 partners.
- **Per-partner sub-accounts.** Build when you outgrow the single sub-account.
- **Lead dedup / smart routing.** Build when the volume justifies it.

For v1 with one partner, the 3 workflows above handle 100% of what you need.