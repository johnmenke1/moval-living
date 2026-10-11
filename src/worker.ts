import handler from 'vinext/server/fetch-handler'
import { requestScope } from './db/runtime.worker'
import type { DbScope } from './db/runtime'

export * from 'vinext/server/fetch-handler'

interface CronEnv {
  CRON_SECRET?: string
}

/**
 * Worker entry: vinext's request handler plus Cloudflare cron. The cron simply
 * calls the existing Next route handler in-process, so the logic and its
 * x-cron-secret auth stay in one place (replaces vercel.json "crons").
 */
export default {
  ...handler,
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const url = new URL(request.url)
    // Canonical host is www (the old Vercel project redirected the apex).
    if (url.hostname === 'moval.living') {
      url.hostname = 'www.moval.living'
      return Response.redirect(url.toString(), 308)
    }
    const scope: DbScope = {}
    const ec = ctx as { waitUntil(p: Promise<unknown>): void }
    const res = await requestScope.run(scope, () =>
      (handler as { fetch(r: Request, e: unknown, c: unknown): Promise<Response> }).fetch(request, env, ctx),
    )
    // Close this request's pool once the (possibly streaming) body is done.
    const close = () => scope.pool?.end().catch(() => {})
    if (!res.body) {
      ec.waitUntil(Promise.resolve(close()))
      return res
    }
    const { readable, writable } = new TransformStream()
    ec.waitUntil(res.body.pipeTo(writable).catch(() => {}).finally(() => close()))
    return new Response(readable, res)
  },
  async scheduled(controller: { cron: string }, env: CronEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const path = CRON_ROUTES[controller.cron]
    if (!path) return
    const req = new Request(`https://moval.living${path}`, {
      headers: { 'x-cron-secret': env.CRON_SECRET ?? '' },
    })
    const scope: DbScope = {}
    ctx.waitUntil(
      requestScope
        .run(scope, async () => {
          const res = await (handler as { fetch(r: Request, e: unknown, c: unknown): Promise<Response> }).fetch(req, env, ctx)
          if (!res.ok) console.error(`[cron] ${path} -> ${res.status}`, await res.text())
          else await res.text()
        })
        .finally(() => scope.pool?.end().catch(() => {})),
    )
  },
}

const CRON_ROUTES: Record<string, string> = {
  '0 10 * * *': '/api/cron/archive-past-events',
}
