import handler from 'vinext/server/fetch-handler'

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
    return (handler as { fetch(r: Request, e: unknown, c: unknown): Promise<Response> }).fetch(request, env, ctx)
  },
  async scheduled(controller: { cron: string }, env: CronEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const path = CRON_ROUTES[controller.cron]
    if (!path) return
    const req = new Request(`https://moval.living${path}`, {
      headers: { 'x-cron-secret': env.CRON_SECRET ?? '' },
    })
    ctx.waitUntil(
      (handler as { fetch(r: Request, e: unknown, c: unknown): Promise<Response> })
        .fetch(req, env, ctx)
        .then(async (res) => {
          if (!res.ok) console.error(`[cron] ${path} -> ${res.status}`, await res.text())
        }),
    )
  },
}

const CRON_ROUTES: Record<string, string> = {
  '0 10 * * *': '/api/cron/archive-past-events',
}
