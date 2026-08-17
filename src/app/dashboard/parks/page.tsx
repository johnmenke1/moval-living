import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ParksAdminClient } from '@/components/admin/ParksAdminClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Parks Admin — MoVal Living',
  robots: { index: false, follow: false },
}

export default async function ParksAdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const parks = await prisma.park.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      address: true,
      amenities: true,
      latitude: true,
      longitude: true,
      googlePlaceId: true,
      googleRating: true,
      googleReviewCount: true,
      heroPhotoUrl: true,
      photoUrls: true,
      blurb: true,
      description: true,
      featured: true,
      isActive: true,
      updatedAt: true,
    },
  })

  // JSON-friendly serialization (Date → ISO).
  const jsonParks = parks.map((p) => ({
    ...p,
    photoCount: p.photoUrls.length,
    hasCoords: p.latitude != null && p.longitude != null,
    updatedAt: p.updatedAt.toISOString(),
  }))

  return <ParksAdminClient initialParks={jsonParks} />
}
