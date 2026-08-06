// Server-side markdown preview for the admin editor.
// Runs the same renderMarkdown() that the public post pages use so the
// preview is an accurate representation of what visitors will see.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { renderMarkdown } from '@/lib/markdown'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const markdown: string = typeof body?.markdown === 'string' ? body.markdown : ''
  const html = renderMarkdown(markdown)
  return NextResponse.json({ html })
}