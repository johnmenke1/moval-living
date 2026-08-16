/**
 * POST /api/admin/upload-asset
 *
 * Admin-only endpoint: upload an arbitrary image (or other file) to
 * Vercel Blob. Returns the resulting Blob URL.
 *
 * Accepts:
 *   - multipart/form-data with a 'file' field
 *   - OR JSON with { url: string } (server downloads + uploads)
 *
 * Response:
 *   { url: string } // public Blob URL
 *
 * Auth: admin session (CRON_SECRET NOT allowed — this is admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { z } from 'zod'

// @vercel/blob requires Node.js runtime
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Allow admin session OR CRON_SECRET (so scripts can upload via curl).
  const cronSecret = process.env.CRON_SECRET
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  const isCron = cronSecret && bearer === cronSecret
  if (!isCron) {
    try {
      const session = await auth()
      if (!session?.user?.id || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch (err) {
      return NextResponse.json({ error: `Auth error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }
  }

  let contentType: string
  try {
    contentType = req.headers.get('content-type') || ''
  } catch (err) {
    return NextResponse.json({ error: `header error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }

  // Path 1: multipart upload from a file picker
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'admin'
    if (!file) {
      return NextResponse.json({ error: 'No file in form data' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'bin'
    const blobPath = `${folder}/${file.name.replace(/\.[^.]+$/, '')}-${Date.now()}.${ext}`
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    })
    return NextResponse.json({ url: blob.url })
  }

  // Path 2: JSON with external URL to fetch
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = z.object({
    url: z.string().url().max(2000),
    folder: z.string().max(64).optional(),
    filename: z.string().max(128).optional(),
  }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const imgRes = await fetch(parsed.data.url, {
    headers: { 'User-Agent': 'moval.living/0.1 (admin-upload@example.com)' },
  })
  if (!imgRes.ok) {
    return NextResponse.json({ error: `Fetch failed: ${imgRes.status}` }, { status: 502 })
  }
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const sourceContentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const ext = sourceContentType.includes('png') ? 'png'
    : sourceContentType.includes('webp') ? 'webp'
    : 'jpg'
  const filename = parsed.data.filename || `asset-${Date.now()}`
  const folder = parsed.data.folder || 'admin'
  const blobPath = `${folder}/${filename}.${ext}`
  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType: sourceContentType,
  })
  return NextResponse.json({ url: blob.url })
}
