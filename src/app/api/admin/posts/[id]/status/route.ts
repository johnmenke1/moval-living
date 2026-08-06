import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { transitionPostStatus, guestPostStatusSchema, checkPostCadence } from '@/lib/guest-content'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/admin/posts/[id]/status — transition workflow state
//
// This is the only route that changes a post's `status`. Cadence enforcement
// runs here on the publish transition.
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = guestPostStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Cadence check on publish — block if the author is at their monthly limit.
  if (parsed.data.status === 'published') {
    const post = await (
      await import('@/lib/prisma')
    ).prisma.guestPost.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    // Skip cadence check if post is already published (idempotent).
    if (post.status !== 'published') {
      const cadence = await checkPostCadence(post.authorId)
      if (!cadence.allowed) {
        return NextResponse.json(
          {
            error: 'cadence_limit',
            message: `Author has hit their monthly post limit. Limit resets ${cadence.resetsAt?.toISOString()}.`,
            resetsAt: cadence.resetsAt?.toISOString(),
          },
          { status: 422 }
        )
      }
    }
  }

  try {
    const post = await transitionPostStatus(id, parsed.data)
    return NextResponse.json(post)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}