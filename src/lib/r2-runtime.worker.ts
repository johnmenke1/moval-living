import { env } from 'cloudflare:workers'
import type { R2Like } from './r2-runtime'

/** Worker build: MEDIA is the R2 bucket binding (cloudflare.config.ts). */
export function getBucket(): R2Like | undefined {
  return (env as { MEDIA?: R2Like }).MEDIA
}
export function publicBaseUrl(): string | undefined {
  return (env as { R2_PUBLIC_URL?: string }).R2_PUBLIC_URL
}
