import type { Auth } from '../auth/Auth'
import { ServiceError } from '../errors'

/**
 * Authenticated client for the Cognatum (SIL) API.
 *
 * Every request carries the signed-in user's Auth0 access token and the
 * `X-SIL-Tenant` header. SIL resolves the tenant from that header (a user in
 * more than one workspace must name one, or every call is refused with
 * TENANT_SELECTION_REQUIRED), and the header only works for a tenant the user
 * is an active member of.
 *
 * `tenant` may be the tenant's UUID or its slug (e.g. `casante`); a slug is
 * looked up once in `GET /me/memberships`.
 */
const TIMEOUT_MS = 20_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /me/memberships item (SIL openapi `MyMembershipView`) */
export interface SilMembership {
  tenant_id: string
  slug: string
  name: string
  tenant_status: 'active' | 'suspended'
}

/** GET /auth/me (SIL openapi `MeResponse`, the fields the app reads) */
export interface SilMe {
  id: string
  email: string
  display_name: string | null
  roles: string[]
  permissions: string[]
}

export interface SilConnection {
  me: SilMe
  tenant: SilMembership
}

export class SilClient {
  private baseUrl: string | null
  private tenantLookup: Promise<SilMembership> | null = null

  constructor(
    baseUrl: string | undefined,
    private tenant: string | undefined,
    private auth: Auth,
  ) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  }

  get configured(): boolean {
    return this.baseUrl !== null && !!this.tenant && this.auth.enabled
  }

  /** Bearer token + tenant header, for any client that calls a SIL-backed URL. */
  async authHeaders(): Promise<Record<string, string>> {
    const tenant = await this.resolveTenant()
    return { Authorization: `Bearer ${await this.token()}`, 'X-SIL-Tenant': tenant.tenant_id }
  }

  /** A tenant-bound call (the normal case). */
  async request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    return this.send<T>(method, path, body, await this.authHeaders())
  }

  /** Who SIL thinks the caller is, inside the configured tenant. Use it as a connection check. */
  async connect(): Promise<SilConnection> {
    const tenant = await this.resolveTenant()
    const me = await this.request<SilMe>('GET', '/auth/me')
    return { me, tenant }
  }

  memberships(): Promise<{ memberships: SilMembership[] }> {
    // Tenant-agnostic route: no X-SIL-Tenant header.
    return this.token().then((t) => this.send('GET', '/me/memberships', undefined, { Authorization: `Bearer ${t}` }))
  }

  private resolveTenant(): Promise<SilMembership> {
    this.tenantLookup ??= this.lookupTenant().catch((e) => {
      this.tenantLookup = null // let a retry look it up again
      throw e
    })
    return this.tenantLookup
  }

  private async lookupTenant(): Promise<SilMembership> {
    const want = (this.tenant ?? '').trim()
    if (!want) throw new ServiceError('not-configured', 'VITE_SIL_TENANT is not set')
    const { memberships } = await this.memberships()
    const key = want.toLowerCase()
    const match = memberships.find((m) =>
      UUID_RE.test(want) ? m.tenant_id.toLowerCase() === key : m.slug.toLowerCase() === key,
    )
    if (!match) throw new ServiceError('forbidden', `Not a member of the "${want}" workspace`)
    if (match.tenant_status !== 'active') throw new ServiceError('forbidden', `The "${want}" workspace is suspended`)
    return match
  }

  private async token(): Promise<string> {
    if (!this.auth.enabled) throw new ServiceError('not-configured', 'Sign-in is not configured (VITE_AUTH)')
    try {
      return await this.auth.getAccessToken()
    } catch {
      throw new ServiceError('unauthorized', 'No access token')
    }
  }

  private async send<T>(method: string, path: string, body: unknown, headers: Record<string, string>): Promise<T> {
    if (!this.baseUrl) throw new ServiceError('not-configured', 'VITE_SIL_API_URL is not set')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      })
    } catch (e) {
      throw new ServiceError((e as Error).name === 'AbortError' ? 'timeout' : 'network', `${method} ${path} failed`)
    } finally {
      clearTimeout(timer)
    }
    if (res.status === 204) return null as T
    if (res.ok) return (await res.json()) as T
    const code = await errorCode(res)
    const detail = `${method} ${path}: ${res.status}${code ? ` ${code}` : ''}`
    if (res.status === 401) throw new ServiceError('unauthorized', detail)
    if (res.status === 403) throw new ServiceError('forbidden', detail)
    if (res.status === 404) throw new ServiceError('not-found', detail)
    throw new ServiceError('server', detail)
  }
}

/** SIL error bodies carry a typed code (e.g. TENANT_FORBIDDEN); useful in logs and the demo menu. */
async function errorCode(res: Response): Promise<string | null> {
  try {
    const j: unknown = await res.json()
    if (j && typeof j === 'object') {
      const o = j as { code?: unknown; error?: { code?: unknown }; detail?: { code?: unknown } }
      const c = o.code ?? o.error?.code ?? o.detail?.code
      return typeof c === 'string' ? c : null
    }
  } catch {
    /* not JSON */
  }
  return null
}
