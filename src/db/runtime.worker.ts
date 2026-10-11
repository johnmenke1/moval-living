import { AsyncLocalStorage } from 'node:async_hooks'
import { env } from 'cloudflare:workers'
import type { DbScope } from './runtime'

/**
 * Workers forbid I/O objects (sockets, pools) from crossing requests, so every
 * request gets its own scope: one pool shared by all of that request's queries,
 * closed by src/worker.ts when the response has finished streaming. The
 * connection string comes from the Hyperdrive binding (HYPERDRIVE in
 * cloudflare.config.ts), and Hyperdrive does the real pooling.
 */
export const perRequestClient = true
export const requestScope = new AsyncLocalStorage<DbScope>()
export function hyperdriveUrl(): string | undefined {
  return (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE?.connectionString
}
