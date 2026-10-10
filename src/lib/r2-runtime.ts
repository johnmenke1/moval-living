/** Node default: no R2 binding, storage falls back to Vercel Blob. */
export interface R2Like {
  put(key: string, body: unknown, opts?: unknown): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  head(key: string): Promise<unknown | null>
}
export function getBucket(): R2Like | undefined {
  return undefined
}
export function publicBaseUrl(): string | undefined {
  return process.env.R2_PUBLIC_URL
}
