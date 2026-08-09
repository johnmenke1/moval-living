import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — moval.living',
  description:
    'Terms of Service for moval.living, the Moreno Valley local business directory. Covers account use, business listings, paid plans, messaging consent, and 10DLC compliance.',
}

export default function TermsPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container-max py-12 max-w-3xl">
        <Link href="/" className="text-sm text-primary hover:underline mb-4 inline-block">
          ← Back to moval.living
        </Link>

        <h1 className="text-4xl font-bold text-text mb-2">Terms of Service</h1>
        <p className="text-sm text-text-secondary mb-8">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="prose prose-slate max-w-none space-y-6 text-text leading-relaxed">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using moval.living (&ldquo;the Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), operated from
              23110 Atlantic Circle, Suite F, Moreno Valley, CA 92553, you agree to be bound by these
              Terms of Service. If you do not agree, do not use the Service.
            </p>
            <p>
              The Service is a free local business directory for Moreno Valley, California. We list
              businesses, host business profiles, enable user reviews, and offer paid membership
              tiers (Featured, Expert Partner) for businesses that want enhanced visibility.
            </p>
          </Section>

          <Section title="2. Eligibility & Account Registration">
            <p>
              You must be at least 18 years old to create an account or claim a business listing.
              When you create an account, you agree to provide accurate information and to keep
              your password secure. You are responsible for all activity that occurs under your
              account.
            </p>
            <p>
              To claim a business listing, you must own or be authorized to manage the business.
              You agree to provide proof of authorization if we request it. We may revoke claimed
              listings if we determine the claimant is not authorized.
            </p>
          </Section>

          <Section title="3. Communications Consent (10DLC / TCPA / CAN-SPAM)">
            <p className="font-semibold text-text">
              We comply with the Telephone Consumer Protection Act (TCPA), 10DLC (10-Digit Long
              Code) registration requirements for Application-to-Person (A2P) messaging, and the
              CAN-SPAM Act for email.
            </p>
            <p>
              <strong>Email:</strong> We only send marketing emails to recipients who have
              explicitly opted in. Each marketing email includes our physical address and a
              working unsubscribe link. You may unsubscribe at any time by clicking the link in
              any email or contacting us at hello@moval.living.
            </p>
            <p>
              <strong>SMS / Text Messages:</strong> We do not send SMS marketing messages. If
              we ever do, we will only send to numbers whose owners have explicitly opted in by
              checking a separate SMS consent checkbox (not pre-checked). Message frequency will
              be disclosed at opt-in. Standard message and data rates apply. Reply STOP to
              unsubscribe at any time, HELP for help.
            </p>
            <p>
              <strong>Voicemail / Robocalls:</strong> We do not place automated calls or send
              prerecorded voicemails.
            </p>
          </Section>

          <Section title="4. User-Generated Content (Reviews, Photos, Posts)">
            <p>
              You retain ownership of content you submit (reviews, photos, business descriptions,
              guest posts). You grant us a non-exclusive, worldwide, royalty-free license to use,
              display, modify, and distribute that content on the Service for the purpose of
              operating the directory.
            </p>
            <p>
              You agree that your reviews and posts will be truthful, not defamatory, not
              infringing on others&rsquo; rights, and not spam. Reviews are subject to moderation.
              We may remove content that violates our policies or these Terms.
            </p>
            <p>
              You may not impersonate others, claim to represent a business you are not
              affiliated with, or post content intended to manipulate search rankings.
            </p>
          </Section>

          <Section title="5. Business Listings & Paid Plans">
            <p>
              Free business listings are provided as-is. Featured and Expert Partner tiers are
              paid subscriptions billed through Stripe. Subscription terms (price, billing cycle,
              cancellation) are presented at checkout and managed through your dashboard.
            </p>
            <p>
              Expert Partner tier includes a one-slot-per-category exclusivity arrangement.
              We may, at our discretion, transition legacy Founding Partners (locked at $997/yr)
              to the current $1,997/yr Expert Partner rate on or after their renewal date.
            </p>
            <p>
              Refunds: Annual subscriptions may be refunded within 30 days of purchase. Monthly
              subscriptions are non-refundable. Contact hello@moval.living for refund requests.
            </p>
          </Section>

          <Section title="6. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Use the Service for any unlawful purpose</li>
              <li>Post false, misleading, or defamatory content</li>
              <li>Spam, harass, or threaten other users</li>
              <li>Attempt to access non-public areas of the Service</li>
              <li>Scrape, crawl, or harvest data without written permission</li>
              <li>Interfere with the Service or other users&rsquo; enjoyment of it</li>
              <li>Circumvent any rate limits, captchas, or security measures</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              The Service, including its design, code, and branding, is owned by moval.living
              and protected by US copyright and trademark law. You may not copy, modify, or
              distribute our branding or code without written permission.
            </p>
          </Section>

          <Section title="8. Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES
              OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, MOVAL.LIVING SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS
              OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </Section>

          <Section title="10. Indemnification">
            <p>
              You agree to indemnify and hold moval.living, its operators, and affiliates harmless
              from any claims arising from your use of the Service, your content, or your
              violation of these Terms.
            </p>
          </Section>

          <Section title="11. Termination">
            <p>
              We may suspend or terminate your account at any time for violation of these Terms
              or for any other reason at our discretion. You may close your account at any time
              by contacting hello@moval.living. Upon termination, your data will be deleted
              according to our Privacy Policy.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These Terms are governed by the laws of the State of California, without regard to
              conflict-of-laws principles. Disputes will be resolved in the state or federal
              courts located in Riverside County, California.
            </p>
          </Section>

          <Section title="13. Changes to Terms">
            <p>
              We may update these Terms from time to time. We will post the updated Terms on
              this page and update the &ldquo;Last updated&rdquo; date. Continued use of the Service
              after changes constitutes acceptance of the new Terms.
            </p>
          </Section>

          <Section title="14. Contact">
            <p>
              Questions about these Terms? Contact us at:
              <br />
              <strong>moval.living</strong>
              <br />
              23110 Atlantic Circle, Suite F
              <br />
              Moreno Valley, CA 92553
              <br />
              <a href="mailto:hello@moval.living" className="text-primary hover:underline">
                hello@moval.living
              </a>
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-text mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}