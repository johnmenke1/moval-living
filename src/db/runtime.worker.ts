import { env } from 'cloudflare:workers'

/**
 * Workers forbid I/O objects (sockets, pools) from crossing requests, so the
 * client is rebuilt per access and the connection string comes from the
 * Hyperdrive binding (HYPERDRIVE in cloudflare.config.ts).
 */
export const perRequestClient = true
export function hyperdriveUrl(): string | undefined {
  return (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE?.connectionString
}
