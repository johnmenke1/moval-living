/**
 * Runtime hooks for the DB client. Node (Vercel, tests, scripts) uses this
 * default; the Cloudflare build aliases `@/db/runtime` to runtime.worker.ts
 * (see vite.config.ts).
 */
export const perRequestClient = false
export function hyperdriveUrl(): string | undefined {
  return undefined
}
