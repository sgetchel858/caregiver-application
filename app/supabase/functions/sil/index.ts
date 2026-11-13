// Casanté → Cognatum (SIL) proxy for the hosted demo.
//
// The browser can't call Cognatum from https://sgetchel858.github.io: SIL's CORS
// allowlist is exact and doesn't include it, and changing SIL config is out of
// scope. This function makes the same calls server-to-server, where CORS doesn't
// apply, and answers the browser with CORS headers for the Casanté origins only.
//
// It holds no secret and adds no identity: it forwards the signed-in user's Auth0
// access token and X-SIL-Tenant header, and SIL verifies both, so the caller can
// do exactly what they could do in Cognatum, limited further to the routes below
// (what Ask and the demo menu's connection test and recall test need). Seeding
// uploads stay local-dev only.
//
// Deployed with verify_jwt = false (config.toml): the token is an Auth0 access
// token for https://sil-api, not a Supabase token, and SIL is the one that checks it.
// Never log tokens, questions or answers: answers carry health details.
//
//   app → https://<project>.supabase.co/functions/v1/sil/<SIL path>  →  SIL_API_URL/<SIL path>

const SIL_API_URL = (Deno.env.get('SIL_API_URL') ?? 'https://app.cognatum-demo.com/api/v1').replace(/\/+$/, '')
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://sgetchel858.github.io,http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
)
const TIMEOUT_MS = 25_000
const MAX_BODY_BYTES = 64 * 1024

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const ROUTES: { method: 'GET' | 'POST'; path: RegExp; query: string[] }[] = [
  { method: 'GET', path: /^\/me\/memberships$/, query: [] },
  { method: 'GET', path: /^\/auth\/me$/, query: [] },
  { method: 'GET', path: /^\/folders$/, query: ['limit', 'offset', 'parent_id'] },
  { method: 'GET', path: new RegExp(`^/folders/${UUID}/documents$`), query: ['limit', 'offset'] },
  { method: 'POST', path: new RegExp(`^/folders/${UUID}/chat$`), query: [] },
]

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-sil-tenant, content-type, accept, apikey, x-client-info',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

function json(status: number, code: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ code }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsHeaders(origin)
  // A browser on any other site gets no CORS headers and is refused outright.
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, 'ORIGIN_NOT_ALLOWED', cors)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  const url = new URL(req.url)
  // The function sees /sil/<path> (or /functions/v1/sil/<path>); SIL wants /<path>.
  const path = url.pathname.replace(/^.*?\/sil(?=\/|$)/, '') || '/'
  const route = ROUTES.find((r) => r.method === req.method && r.path.test(path))
  if (!route) return json(404, 'ROUTE_NOT_ALLOWED', cors)

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json(401, 'MISSING_TOKEN', cors)

  const query = new URLSearchParams()
  for (const key of route.query) {
    const v = url.searchParams.get(key)
    if (v !== null) query.set(key, v)
  }

  const headers: Record<string, string> = { Authorization: auth, Accept: 'application/json' }
  const tenant = req.headers.get('X-SIL-Tenant')
  if (tenant) headers['X-SIL-Tenant'] = tenant

  let body: string | undefined
  if (req.method === 'POST') {
    body = await req.text()
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return json(413, 'BODY_TOO_LARGE', cors)
    headers['Content-Type'] = 'application/json'
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const started = Date.now()
  try {
    const qs = query.toString()
    const res = await fetch(`${SIL_API_URL}${path}${qs ? `?${qs}` : ''}`, { method: req.method, headers, body, signal: ctrl.signal })
    const text = await res.text()
    // Route shape and status only: never the token, the question or the answer.
    console.log(JSON.stringify({ method: req.method, route: route.path.source, status: res.status, ms: Date.now() - started }))
    return new Response(text, {
      status: res.status,
      headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch (e) {
    const timeout = (e as Error).name === 'AbortError'
    console.log(JSON.stringify({ method: req.method, route: route.path.source, error: timeout ? 'timeout' : 'network' }))
    return json(timeout ? 504 : 502, timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE', cors)
  } finally {
    clearTimeout(timer)
  }
})
