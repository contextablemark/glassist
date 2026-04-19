/**
 * Glassist Vikunja Proxy — Cloudflare Worker
 *
 * Pure CORS relay. Glassist runs inside the Even Hub WebView (or on a
 * Vercel static build) whose Origin is not on Vikunja Cloud's CORS
 * allowlist, so direct calls fail. This worker forwards every incoming
 * request to the configured upstream Vikunja instance, preserves the
 * caller's `Authorization: Bearer <user-token>` header, and returns the
 * response with permissive CORS headers.
 *
 * The worker has no API key of its own. Each user's Vikunja token
 * travels through untouched — we never see it beyond the in-memory
 * request hop.
 *
 * Configuration:
 *   UPSTREAM — target Vikunja base URL (e.g. https://app.vikunja.cloud).
 *              Defaults to Vikunja Cloud if unset. Set via
 *              `wrangler secret put UPSTREAM` or [vars] in wrangler.toml.
 */

interface Env {
  UPSTREAM?: string
}

const DEFAULT_UPSTREAM = 'https://app.vikunja.cloud'

// Request headers we do NOT forward upstream. Cloudflare-specific ones
// would confuse Vikunja; host/origin/referer would interfere with its
// own request handling.
const HEADER_DENYLIST = new Set([
  'host',
  'origin',
  'referer',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    const upstream = (env.UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, '')
    const url = new URL(request.url)
    const target = upstream + url.pathname + url.search

    const headers = new Headers()
    request.headers.forEach((value, key) => {
      const lk = key.toLowerCase()
      if (HEADER_DENYLIST.has(lk)) return
      if (lk.startsWith('cf-')) return
      headers.set(key, value)
    })

    const init: RequestInit = { method: request.method, headers }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer()
    }

    try {
      const resp = await fetch(target, init)
      const body = await resp.arrayBuffer()
      const respHeaders = new Headers()
      resp.headers.forEach((value, key) => {
        const lk = key.toLowerCase()
        // Strip upstream CORS (we set our own) and content-encoding
        // (fetch has already decoded the body).
        if (lk.startsWith('access-control-')) return
        if (lk === 'content-encoding') return
        respHeaders.set(key, value)
      })
      for (const [k, v] of Object.entries(corsHeaders(request))) {
        respHeaders.set(k, v)
      }
      return new Response(body, { status: resp.status, headers: respHeaders })
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Upstream error',
          message: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request),
          },
        },
      )
    }
  },
}

function corsHeaders(req: Request): Record<string, string> {
  // Reflect the incoming Origin so credentials-style requests work. When
  // there's no Origin (e.g. curl), fall back to * — our worker carries
  // no secrets of its own, so this is safe.
  const origin = req.headers.get('Origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods':
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
