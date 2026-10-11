/**
 * Runtime hooks for the DB client. Node (Vercel, tests, scripts) uses this
 * default; the Cloudflare build aliases `@/db/runtime` to runtime.worker.ts
 * (see vite.config.ts).
 */
export interface DbScope {
  db?: unknown
  pool?: { end(): Promise<void> }
}
export const perRequestClient = false
/** Worker only: AsyncLocalStorage holding the current request's DB scope. */
export const requestScope: { getStore(): DbScope | undefined } | undefined = undefined
export function hyperdriveUrl(): string | undefined {
  return undefined
}
