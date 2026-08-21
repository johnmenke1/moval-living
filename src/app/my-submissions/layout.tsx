import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Submissions — moval.living',
  description:
    'View the businesses you have submitted to moval.living and access your claim links.',
  alternates: { canonical: 'https://www.moval.living/my-submissions' },
  robots: { index: false, follow: false },
}

export default function MySubmissionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
