// ============================================================
// src/lib/trestle-auth.ts
// Shared Trestle OAuth2 client-credentials token management.
// Mirrors the proven working pattern from menke-real-estate.
// ============================================================

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value) return undefined
  return value.trim().replace(/^"|"$/g, '')
}

export function getBaseUrl(): string {
  const raw = readEnv('TRESTLE_BASE_URL') || 'https://api.cotality.com/trestle/odata'
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

export function getPropertyEndpoint(): string {
  const baseUrl = getBaseUrl()
  if (baseUrl.includes('/odata')) {
    return `${baseUrl}/Property`.replace(/\/+/g, '/')
  }
  return `${baseUrl}/odata/Property`.replace(/\/+/g, '/')
}

// Token cache — module-level so it persists across requests
type TokenCache = { token: string; expires: number } | null
let tokenCache: TokenCache = null

async function fetchToken(): Promise<string> {
  const clientId = readEnv('TRESTLE_CLIENT_ID')
  const clientSecret = readEnv('TRESTLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Trestle credentials missing')

  const tokenUrl = getTokenUrl(getBaseUrl())
  const response = await fetch(tokenUrl, {
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
  })

  if (!response.ok) {
    let errorText = await response.text()
    try {
      const json = JSON.parse(errorText)
      if (json.error_description) errorText = json.error_description
      else if (json.error === 'invalid_client') errorText = 'Invalid Trestle Client ID or Client Secret.'
    } catch { /* ignore */ }
    throw new Error(`Failed to get Trestle token: ${errorText}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  const expiresIn = Number(data.expires_in) || 300
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + expiresIn * 1000 - 60_000,
  }
  return tokenCache.token
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token
  return fetchToken()
}

// Alias — matches the name used in the API routes
export const getTrestleToken = getAccessToken
