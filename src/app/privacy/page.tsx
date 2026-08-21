import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — moval.living',
  description:
    'Privacy Policy for moval.living. Covers data collection, CCPA rights, 10DLC messaging privacy, cookies, and how to contact us about your data.',
  alternates: { canonical: 'https://www.moval.living/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container-max py-12 max-w-3xl">
        <Link href="/" className="text-sm text-primary hover:underline mb-4 inline-block">
          ← Back to moval.living
        </Link>

        <h1 className="text-4xl font-bold text-text mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-secondary mb-8">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="prose prose-slate max-w-none space-y-6 text-text leading-relaxed">
          <Section title="Summary">
            <p>
              <strong>Plain English:</strong> We collect the minimum data needed to run a local
              business directory. We do not sell your data. You can request a copy of your data
              or its deletion at any time. We only send you emails or texts that you have
              explicitly opted in to.
            </p>
          </Section>

          <Section title="1. Who We Are">
            <p>
              moval.living (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a local business directory for
              Moreno Valley, California, operated from:
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

          <Section title="2. Information We Collect">
            <p>
              <strong>Information you provide directly:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Account registration: name, email, password (hashed)</li>
              <li>Business listings: business name, address, phone, website, description, photos</li>
              <li>Reviews: rating, content, author name</li>
              <li>Payment: handled by Stripe. We do not store credit card numbers.</li>
              <li>Communications: messages you send to us via email or forms</li>
            </ul>
            <p>
              <strong>Information collected automatically:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Device and browser type, IP address, pages visited, referring URL</li>
              <li>Cookies and similar tracking technologies (see Section 7)</li>
            </ul>
            <p>
              <strong>Information from third parties:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Public business listings imported from Google Places (name, address, phone, website, ratings)</li>
              <li>Authentication providers (Google) if you sign in with them</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Operate, maintain, and improve the Service</li>
              <li>Process business listings and reviews</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (account confirmation, claim links, receipts)</li>
              <li>Send marketing emails only to recipients who have explicitly opted in</li>
              <li>Detect and prevent fraud and abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Communications Consent (10DLC / TCPA / CAN-SPAM)">
            <p className="font-semibold text-text">
              Email Communications:
            </p>
            <p>
              We only send marketing emails to recipients who have explicitly opted in via a
              checkbox or other affirmative action. Each marketing email includes our physical
              address and an unsubscribe link. You may unsubscribe at any time.
            </p>
            <p className="font-semibold text-text">
              SMS / Text Messages:
            </p>
            <p>
              We currently do not send SMS messages. If we ever do, we will only send to numbers
              whose owners have explicitly opted in via a separate SMS consent checkbox (not
              pre-checked). At opt-in we will disclose message frequency and obtain your written
              consent before sending any A2P messages. Standard message and data rates apply.
              Reply STOP to unsubscribe, HELP for help.
            </p>
            <p className="font-semibold text-text">
              10DLC Registration:
            </p>
            <p>
              For any future SMS messaging, we will register our brand and campaign with The
              Campaign Registry (TCR) and provide sample messages, use case, and brand
              information as required by US carriers.
            </p>
          </Section>

          <Section title="5. Your Rights Under California Law (CCPA / CPRA)">
            <p>
              If you are a California resident, you have the following rights:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li><strong>Right to know:</strong> what personal information we collect, use, share, or sell</li>
              <li><strong>Right to delete:</strong> your personal information, with certain exceptions</li>
              <li><strong>Right to correct:</strong> inaccurate personal information</li>
              <li><strong>Right to opt out of sale/sharing:</strong> we do not sell personal information</li>
              <li><strong>Right to limit use of sensitive personal information:</strong> applicable to certain data types</li>
              <li><strong>Right to non-discrimination:</strong> we will not deny service for exercising these rights</li>
            </ul>
            <p>
              To exercise these rights, contact us at{' '}
              <a href="mailto:hello@moval.living" className="text-primary hover:underline">
                hello@moval.living
              </a>{' '}
              or call (during business hours) at the address above. We will respond within 45
              days as required by California law.
            </p>
          </Section>

          <Section title="6. How We Share Your Information">
            <p>
              <strong>We do not sell your personal information.</strong>
            </p>
            <p>We share information only with:</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>
                <strong>Service providers:</strong> Postgres (database), Stripe (payments),
                Vercel (hosting), AWS (email), Google (auth). Each is bound by their own
                privacy agreements.
              </li>
              <li>
                <strong>Legal compliance:</strong> when required by law or to protect our rights.
              </li>
              <li>
                <strong>Business transfers:</strong> in the event of a merger, acquisition, or sale
                of assets.
              </li>
            </ul>
            <p>
              Business listings (name, address, phone, website) are publicly visible to anyone
              using the directory. Do not list personal information that you do not want public.
            </p>
          </Section>

          <Section title="7. Cookies & Tracking">
            <p>
              We use cookies and similar tracking technologies for:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Authentication (so you stay logged in)</li>
              <li>Analytics (Google Analytics, in aggregate only)</li>
              <li>Personalization (remembering your city preferences)</li>
            </ul>
            <p>
              You can disable cookies in your browser settings, but some features of the Service
              may not work without them.
            </p>
          </Section>

          <Section title="8. Data Security">
            <p>
              We use industry-standard security measures including HTTPS, encrypted password
              storage (bcrypt), and database access controls. No method of transmission over the
              internet is 100% secure, however, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="9. Data Retention">
            <p>
              We retain your account data for as long as your account is active. If you close
              your account, we will delete your personal information within 90 days, except where
              we are required to retain it for legal, tax, or audit purposes (e.g., Stripe
              transaction records).
            </p>
          </Section>

          <Section title="10. Children&rsquo;s Privacy">
            <p>
              The Service is not directed to children under 13. We do not knowingly collect
              personal information from children under 13. If you believe we have, please contact
              us at hello@moval.living.
            </p>
          </Section>

          <Section title="11. International Users">
            <p>
              The Service is operated from the United States and is intended for users in the
              United States. If you are accessing the Service from outside the US, you consent
              to the transfer of your information to the US.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Policy from time to time. We will post the updated Policy on
              this page and update the &ldquo;Last updated&rdquo; date. If changes are material,
              we will provide additional notice (e.g., email or banner).
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about this Policy? Contact us at:
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