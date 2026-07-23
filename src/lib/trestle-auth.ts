// ============================================================
// src/lib/trestle-auth.ts
// Shared Trestle OAuth2 client-credentials token management.
// Used by all Trestle API routes — token is cached and
// auto-refreshed before expiry.
// ============================================================

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value) return undefined
  return value.trim().replace(/^"|"$/g, '')
}

function getBaseUrl(): string {
  const raw = readEnv('TRESTLE_BASE_URL') || 'https://api-prod.corelogic.com/trestle/odata'
  return raw.replace(/\/$/, '')
}

function getTokenUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '')
  if (normalized.includes('cotality.com')) {
    const cleaned = normalized.replace(/\/odata$/, '')
    if (cleaned.endsWith('/oidc')) {
      return `${cleaned}/connect/token`.replace(/\/+/g, '/')
    }
    return `${cleaned}/oidc/connect/token`.replace(/\/+/g, '/')
  }
  return `${normalized}/connect/token`.replace(/\/+/g, '/')
}

function getPropertyEndpoint(): string {
  const baseUrl = getBaseUrl()
  if (baseUrl.includes('/odata')) {
    return `${baseUrl}/Property`.replace(/\/+/g, '/')
  }
  return `${baseUrl}/odata/Property`.replace(/\/+/g, '/')
}

export { getPropertyEndpoint }

let tokenCache: { token: string; expires: number } | null = null

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now()) {
    return tokenCache.token
  }

  const clientId = readEnv('TRESTLE_CLIENT_ID')
  const clientSecret = readEnv('TRESTLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('Trestle credentials missing (TRESTLE_CLIENT_ID/SECRET)')
  }

  const tokenUrl = getTokenUrl(getBaseUrl())
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'api',
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Trestle auth failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  const expiresIn = Number(data.expires_in) || 300
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + expiresIn * 1000 - 60_000, // refresh 60s early
  }
  return tokenCache.token
}
