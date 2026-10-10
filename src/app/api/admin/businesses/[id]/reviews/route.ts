import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, business as businessTable, review } from '@/db'
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

  const business = await db.query.business.findFirst({
    where: eq(businessTable.id, id),
    columns: { id: true, name: true },
  })
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const deleted = await db.delete(review).where(eq(review.businessId, id)).returning({ id: review.id })

  return NextResponse.json({ deleted: deleted.length, business: business.name })
}
