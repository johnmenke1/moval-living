import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export default async function ClaimCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const session = await auth()
  const { token } = await searchParams

  console.log('[claim/complete] session:', JSON.stringify(session))
  console.log('[claim/complete] token:', token)

  if (!token) {
    console.log('[claim/complete] no token, redirecting to /login')
    redirect('/login')
  }

  if (!session?.user?.email) {
    console.log('[claim/complete] no session user email, redirecting to /login')
    redirect('/login')
  }

  const business = await prisma.business.findUnique({
    where: { claimToken: token },
    select: { id: true, name: true, ownerId: true, claimExpiresAt: true },
  })

  console.log('[claim/complete] business:', JSON.stringify(business))

  if (business && !business.ownerId) {
    let owner = await prisma.owner.findUnique({
      where: { email: session.user.email! },
    })

    if (!owner) {
      owner = await prisma.owner.create({
        data: {
          email: session.user.email!,
          name: session.user.name || null,
          image: session.user.image || null,
          emailVerified: new Date(),
        },
      })
      console.log('[claim/complete] created owner:', owner.id)
    }

    await prisma.business.update({
      where: { id: business.id },
      data: {
        ownerId: owner.id,
        claimToken: null,
        claimExpiresAt: null,
        email: session.user.email!,
        status: 'APPROVED',
      },
    })
    console.log('[claim/complete] business claimed successfully')
  }

  redirect('/dashboard')
}
