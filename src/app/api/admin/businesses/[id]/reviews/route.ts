import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// DELETE /api/admin/businesses/[id]/reviews — delete all reviews for a business
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const business = await prisma.business.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const result = await prisma.review.deleteMany({ where: { businessId: id } })

  return NextResponse.json({ deleted: result.count, business: business.name })
}
