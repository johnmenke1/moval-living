import { ChamberDirectory } from '@/components/business/ChamberDirectory'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Moreno Valley Chamber of Commerce Member Directory',
  description:
    'Browse Moreno Valley Chamber of Commerce members on moval.living — a live directory of chamber businesses serving Moreno Valley, CA.',
  alternates: { canonical: 'https://www.moval.living/chamber' },
}

// Membership flags change from the dashboard — keep this directory live.
export const dynamic = 'force-dynamic'

export default function ChamberPage() {
  return <ChamberDirectory variant="chamber" />
}
