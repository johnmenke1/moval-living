import { ChamberDirectory } from '@/components/business/ChamberDirectory'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MV Hispanic Chamber of Commerce Member Directory',
  description:
    'Browse Moreno Valley Hispanic Chamber of Commerce members on moval.living — a live directory of member businesses, muchos con atención en español.',
  alternates: { canonical: 'https://www.moval.living/hispanic-chamber' },
}

// Membership flags change from the dashboard — keep this directory live.
export const dynamic = 'force-dynamic'

export default function HispanicChamberPage() {
  return <ChamberDirectory variant="hispanic" />
}
