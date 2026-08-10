# GHL Email Templates — MoVal Cold Outreach

Paste each HTML block into the GHL email template editor (Marketing → Emails → Templates → New).

**Steps in GHL:**
1. Marketing → Emails → Templates → **New Template**
2. Set From: `Emma@moval.living`
3. Set From Name: `Emma at moval.living`
4. Set Reply-To: `hello@moval.living`
5. Paste the HTML (GHL editor has a code view / raw HTML paste)
6. Save
7. Build the workflow that uses these templates (see `docs/GHL-OUTREACH.md`)

---

## Template 1: "Claim Your Free Listing" (initial)

**Subject:** Your free Moreno Valley business listing is ready to claim

**Preview text:** Get discovered by 215,000+ Moreno Valley residents — claim your spot in 2 minutes.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 16px 32px; text-align: center;">
              <img src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo.png"
                   alt="moval.living"
                   width="120"
                   height="auto"
                   style="display: block; margin: 0 auto 12px auto;" />
              <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700;">moval.living</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 16px 32px 32px 32px;">
              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Hi {{contact.first_name}},
              </p>

              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                We've created a new Moreno Valley business directory and your business
                <strong>{{contact.companyName}}</strong> is already listed.
                Claiming your free listing lets you:
              </p>

              <ul style="color: #1f2937; font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
                <li>Update your photos, hours, and description</li>
                <li>Respond to customer reviews</li>
                <li>Get discovered by the 215,000+ residents of Moreno Valley</li>
                <li>Be featured in our weekly "Best of MoVal" newsletter</li>
              </ul>

              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Here's the page we created for <strong>{{contact.last_name}}</strong>:
              </p>

              <p style="margin: 0 0 24px 0;">
                <a href="{{contact.movalliving_listing_url}}"
                   style="display: inline-block; padding: 14px 28px; background: #ffffff; color: #007a7f; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; border: 2px solid #007a7f;">
                  View Your Listing →
                </a>
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Already looks good? <a href="https://moval.living/claim?email={{contact.email | urlencode}}" style="color: #007a7f; font-weight: 600;">Claim it in 2 minutes →</a>
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
                <strong>One click, no password to remember.</strong> We'll send you a magic
                link so you can confirm ownership and finish setup in under 2 minutes.
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Not the right person? Forward this to whoever manages your marketing
                and we'll never email you again.
              </p>

              <!-- Signature -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <tr>
                  <td>
                    <img src="https://movalliving.s3.us-west-1.amazonaws.com/john-signature.png"
                         alt="John Menke"
                         width="160"
                         height="auto"
                         style="display: block; margin: 0 0 4px 0;" />
                    <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 600; line-height: 1.4;">
                      John Menke
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.4;">
                      Founder, moval.living
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Template 2: "Follow-up: Claim Your Free Listing" (3 days later)

**Subject:** Quick reminder — claim your MoVal listing

**Preview text:** Takes 2 minutes. Free forever. No card required.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">

          <tr>
            <td style="padding: 32px 32px 16px 32px; text-align: center;">
              <img src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo.png"
                   alt="moval.living"
                   width="120"
                   height="auto"
                   style="display: block; margin: 0 auto 12px auto;" />
              <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700;">moval.living</h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 16px 32px 32px 32px;">
              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Hi {{contact.first_name}},
              </p>

              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Just a quick follow-up on our last email about
                <strong>{{contact.companyName}}</strong>'s free listing on moval.living.
              </p>

              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Quick recap of why it's worth the 2 minutes:
              </p>

              <ul style="color: #1f2937; font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
                <li><strong>It's free</strong> — no credit card, no commitment</li>
                <li><strong>You keep ownership</strong> — your phone, hours, and photos all editable</li>
                <li><strong>Local SEO boost</strong> — Moreno Valley residents search this directory first</li>
                <li><strong>Reviews work both ways</strong> — you can respond to feedback publicly</li>
              </ul>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                First time seeing this? <a href="{{contact.movalliving_listing_url}}" style="color: #007a7f; font-weight: 600;">Take a quick look at your page →</a>
              </p>

              <p style="margin: 0 0 24px 0;">
                <a href="https://moval.living/claim?email={{contact.email | urlencode}}"
                   style="display: inline-block; padding: 14px 28px; background: #007a7f; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Claim Now (2 minutes)
                </a>
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Not interested? <a href="{{unsubscribe_link}}" style="color: #6b7280;">Unsubscribe</a>
                and we won't email again.
              </p>

              <!-- Signature -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <tr>
                  <td>
                    <img src="https://movalliving.s3.us-west-1.amazonaws.com/john-signature.png"
                         alt="John Menke"
                         width="160"
                         height="auto"
                         style="display: block; margin: 0 0 4px 0;" />
                    <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 600; line-height: 1.4;">
                      John Menke
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.4;">
                      Founder, moval.living
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Template 3: "Last Chance: Claim Your Free Listing" (7 days later)

**Subject:** Last email — should we close your MoVal listing?

**Preview text:** Letting us know takes 30 seconds. Ignoring this won't unsubscribe you.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">

          <tr>
            <td style="padding: 32px 32px 16px 32px; text-align: center;">
              <img src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo.png"
                   alt="moval.living"
                   width="120"
                   height="auto"
                   style="display: block; margin: 0 auto 12px auto;" />
              <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700;">moval.living</h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 16px 32px 32px 32px;">
              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Hi {{contact.first_name}},
              </p>

              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                We don't want to bug you, so this is the last email.
              </p>

              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Your business <strong>{{contact.companyName}}</strong> is still listed
                on moval.living, but your competitors are claiming their spots
                (32 of them in the last week). If you'd like to keep your listing
                accurate and answer customer reviews, claim it now:
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Curious what it looks like? <a href="{{contact.movalliving_listing_url}}" style="color: #007a7f; font-weight: 600;">See your page here →</a>
              </p>

              <p style="margin: 0 0 16px 0;">
                <a href="https://moval.living/claim?email={{contact.email | urlencode}}"
                   style="display: inline-block; padding: 14px 28px; background: #007a7f; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Claim Your Listing
                </a>
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Don't want this listing at all? Reply STOP and we'll remove it.
              </p>

              <!-- Signature -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <tr>
                  <td>
                    <img src="https://movalliving.s3.us-west-1.amazonaws.com/john-signature.png"
                         alt="John Menke"
                         width="160"
                         height="auto"
                         style="display: block; margin: 0 0 4px 0;" />
                    <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 600; line-height: 1.4;">
                      John Menke
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.4;">
                      Founder, moval.living
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Workflow Setup Checklist

After pasting the templates above into GHL:

1. **Marketing → Workflows → New → "MoVal Cold Outreach"**
2. **Trigger:** `Contact tag added` → `moval-living-cold-outreach`
3. **Step 1:** Wait 1 minute (gives the contact time to be fully indexed)
4. **Step 2:** Send email → Template 1 (`Claim Your Free Listing`)
5. **Step 3:** Wait 3 days
6. **Step 4:** If/Else:
   - **Condition:** Contact does NOT have tag `moval-living-listing-claimed`
   - **True branch:** Send email → Template 2 (`Follow-up`)
   - **False branch:** End workflow
7. **Step 5:** Wait 7 days
8. **Step 6:** If/Else (same condition):
   - **True branch:** Send email → Template 3 (`Last Chance`)
   - **False branch:** End workflow
9. **End**

## Field substitutions to verify

GHL token syntax: `{{contact.field_name}}`. Common fields:
- `{{contact.first_name}}` — first name
- `{{contact.last_name}}` — last name
- `{{contact.email}}` — email
- `{{contact.companyName}}` — business name
- `{{contact.phone}}` — phone
- `{{contact.address1}}` — street
- `{{contact.city}}` — city
- `{{contact.state}}` — state
- `{{contact.postalCode}}` — zip
- `{{unsubscribe_link}}` — auto-injected CAN-SPAM link

## CAN-SPAM compliance checklist

- [x] Physical address in footer (set GHL → Settings → Email → Footer)
- [x] Unsubscribe link (auto-injected by GHL via `{{unsubscribe_link}}`)
- [x] Accurate From address
- [x] Non-deceptive subject line
- [x] Sent only to opted-in (cold-outreach tag is your opt-in signal)

## Source

All 3 templates pasted in `docs/GHL-EMAIL-TEMPLATES.md`. Surface this in GHL by:
1. Marketing → Emails → Templates → New
2. Paste each `<!DOCTYPE html>...</html>` block
3. Save with the names above
