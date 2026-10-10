import { getBucket, publicBaseUrl } from '@/lib/r2-runtime'

/**
 * Drop-in replacement for the `put`/`del` pair previously imported from
 * `@vercel/blob`. On Cloudflare it writes to the MEDIA R2 bucket and returns a
 * URL under R2_PUBLIC_URL; on Node (Vercel, during the transition) it still
 * delegates to Vercel Blob so both deploy targets keep working.
 */
export interface PutOptions {
  access?: 'public'
  contentType?: string
  addRandomSuffix?: boolean
  allowOverwrite?: boolean
}

function withRandomSuffix(pathname: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const dot = pathname.lastIndexOf('.')
  const slash = pathname.lastIndexOf('/')
  return dot > slash ? `${pathname.slice(0, dot)}-${suffix}${pathname.slice(dot)}` : `${pathname}-${suffix}`
}

export async function put(
  pathname: string,
  body: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | File | string | Buffer,
  options: PutOptions = {},
): Promise<{ url: string; pathname: string }> {
  const bucket = getBucket()
  if (!bucket) {
    const blob = await import('@vercel/blob')
    return blob.put(pathname, body as never, { access: 'public', ...options } as never) as Promise<{ url: string; pathname: string }>
  }
  const base = publicBaseUrl()
  if (!base) throw new Error('R2_PUBLIC_URL is not configured')
  const key = options.addRandomSuffix === false ? pathname : withRandomSuffix(pathname)
  if (options.addRandomSuffix === false && !options.allowOverwrite && (await bucket.head(key))) {
    throw new Error(`This blob already exists: ${key}`)
  }
  // R2 needs a known length: buffer streams that arrive without one.
  const payload = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body
  await bucket.put(key, payload, { httpMetadata: { contentType: options.contentType } })
  return { url: `${base.replace(/\/$/, '')}/${key}`, pathname: key }
}

export async function del(urlOrUrls: string | string[]): Promise<void> {
  const bucket = getBucket()
  if (!bucket) {
    const blob = await import('@vercel/blob')
    return blob.del(urlOrUrls)
  }
  const base = (publicBaseUrl() ?? '').replace(/\/$/, '')
  const keys = (Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls])
    .filter((u) => !base || u.startsWith(base + '/'))
    .map((u) => (base ? u.slice(base.length + 1) : u))
  if (keys.length) await bucket.delete(keys)
}
