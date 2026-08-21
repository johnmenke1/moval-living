import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'List Your Business — moval.living',
  description:
    'Submit your Moreno Valley business to moval.living. Free basic listing or upgrade to Featured for photos, badge, and homepage placement.',
  alternates: { canonical: 'https://www.moval.living/submit' },
}

export default function SubmitLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
