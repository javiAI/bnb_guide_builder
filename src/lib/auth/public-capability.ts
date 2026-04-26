/**
 * Public guide capabilities — sign / verify / cookie I/O (Rama 15C).
 *
 * Generalizes the slug-scoped HMAC pattern introduced in Rama 13D
 * (`guest-incident-cookie.ts`) into a typed primitive parameterized by
 * `(capability, slug, payload)`. The cryptographic shape is unchanged from
 * 13D — only the envelope is generalized.
 *
 * Guarantees:
 *   - Cross-slug isolation. A cookie minted for slug A never validates against
 *     slug B (the slug is signed inside the envelope and re-checked on verify).
 *   - Cross-capability isolation. A cookie minted for capability X never
 *     validates against capability Y (the capability key is signed inside the
 *     envelope and re-checked on verify, independently of the cookie name).
 *   - Per-capability TTL. Each capability declares its own `ttlSeconds`;
 *     verify rejects envelopes older than that bound.
 *   - Drop-silent semantics. Tampered, expired, or mismatched envelopes return
 *     `null` from verify — never throw, never 403. The caller treats absence
 *     as "no authority" and decides the response (typically 404, never 401).
 *   - Single shared secret. `PUBLIC_CAPABILITY_SECRET` (≥16 chars in prod;
 *     deterministic dev fallback). Rotation invalidates all outstanding
 *     cookies in one move; per-capability isolation comes from the signed
 *     envelope, not from per-cap secrets.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import {
  PUBLIC_CAPABILITIES,
  PUBLIC_CAPABILITY_VERSION,
  isRegisteredCapability,
  type CapabilityKey,
  type CapabilityPayload,
} from './public-capability-registry'

const COOKIE_NAME_PREFIX = 'gc-'
const CLOCK_SKEW_TOLERANCE_SECONDS = 5 * 60

/**
 * RFC 6265 §2.2 cookie-name token charset. Used to fail loudly at module load
 * if any registered capability key would produce a cookie name that proxies
 * or clients could legally drop. Slugs are produced by the platform's
 * base62 generator (`guide-slug.service.ts`) and are RFC 6265 token-safe by
 * construction; only the capability key portion needs runtime validation here.
 */
const RFC_6265_TOKEN_RE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/

for (const key of Object.keys(PUBLIC_CAPABILITIES)) {
  if (!RFC_6265_TOKEN_RE.test(key)) {
    throw new Error(
      `[public-capability] Capability key '${key}' contains characters not safe in RFC 6265 cookie names`,
    )
  }
}

interface CapabilityEnvelope<P> {
  /** Capability key. Must match the verify-time `capability` argument. */
  cap: string
  /** Slug binding. Must match the verify-time `slug` argument. */
  slug: string
  /** Issued-at, seconds since epoch. */
  iat: number
  /** Per-capability payload (validated against `payloadSchema`). */
  payload: P
  /** Envelope schema version. Must equal `PUBLIC_CAPABILITY_VERSION`. */
  v: number
}

const SECRET: string = (() => {
  const env = process.env.PUBLIC_CAPABILITY_SECRET
  if (env && env.length >= 16) return env
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PUBLIC_CAPABILITY_SECRET must be set (≥16 chars) in production',
    )
  }
  return 'dev-only-public-capability-secret-do-not-use-in-prod'
})()

function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64url')
}

function base64urlDecodeToString(input: string): string | null {
  try {
    return Buffer.from(input, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

function hmacDigest(payload: string): Buffer {
  return createHmac('sha256', SECRET).update(payload).digest()
}

/**
 * Cookie name for a `(capability, slug)` pair.
 *
 * Scheme: `gc-<capability>-<slug>`. The `gc-` prefix ("guest capability")
 * namespaces all 15C cookies in client devtools and makes filtering trivial.
 * One cookie per `(capability, slug)` pair — a device that has the guide open
 * for two different properties never lets one property's guest authority
 * spill into the other (slug isolation), and never lets one capability's
 * authority spill into another (capability isolation).
 */
export function publicCapabilityCookieName(
  capability: CapabilityKey,
  slug: string,
): string {
  return `${COOKIE_NAME_PREFIX}${capability}-${slug}`
}

/**
 * Sign a capability envelope. Returns `<base64url envelope>.<base64url hmac>`.
 *
 * The signature covers the already-encoded envelope so verification doesn't
 * need to re-encode (any whitespace / key-order variance between encoder and
 * verifier would silently invalidate cookies).
 */
export function signPublicCapability<C extends CapabilityKey>(args: {
  capability: C
  slug: string
  payload: CapabilityPayload<C>
  nowSeconds?: number
}): string {
  const { capability, slug, payload } = args
  const nowSeconds = args.nowSeconds ?? Math.floor(Date.now() / 1000)

  // Validate the payload at sign time so we never mint a cookie that verify
  // would reject. Throws — sign-time errors are programmer errors, not
  // adversarial input, so loud failure is correct.
  PUBLIC_CAPABILITIES[capability].payloadSchema.parse(payload)

  const envelope: CapabilityEnvelope<CapabilityPayload<C>> = {
    cap: capability,
    slug,
    iat: nowSeconds,
    payload,
    v: PUBLIC_CAPABILITY_VERSION,
  }
  const envelopeB64 = base64urlEncode(JSON.stringify(envelope))
  const sigB64 = base64urlEncode(hmacDigest(envelopeB64))
  return `${envelopeB64}.${sigB64}`
}

/**
 * Verify a capability envelope. Returns the typed payload on success, or
 * `null` on any failure (drop-silent — never throws, never reveals the reason
 * to the caller).
 */
export function verifyPublicCapability<C extends CapabilityKey>(args: {
  raw: string
  capability: C
  slug: string
  nowSeconds?: number
}): { payload: CapabilityPayload<C> } | null {
  const { raw, capability, slug } = args
  const nowSeconds = args.nowSeconds ?? Math.floor(Date.now() / 1000)

  const dot = raw.indexOf('.')
  if (dot <= 0 || dot === raw.length - 1) return null
  const envelopeB64 = raw.slice(0, dot)
  const sigB64 = raw.slice(dot + 1)

  const expectedSig = hmacDigest(envelopeB64)
  let provided: Buffer
  try {
    provided = Buffer.from(sigB64, 'base64url')
  } catch {
    return null
  }
  if (provided.length !== expectedSig.length) return null
  if (!timingSafeEqual(provided, expectedSig)) return null

  const json = base64urlDecodeToString(envelopeB64)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>

  if (obj.v !== PUBLIC_CAPABILITY_VERSION) return null
  if (typeof obj.cap !== 'string' || obj.cap !== capability) return null
  if (typeof obj.slug !== 'string' || obj.slug !== slug) return null
  if (typeof obj.iat !== 'number' || !Number.isFinite(obj.iat)) return null

  const ttl = PUBLIC_CAPABILITIES[capability].ttlSeconds
  if (nowSeconds - obj.iat > ttl) return null
  if (obj.iat - nowSeconds > CLOCK_SKEW_TOLERANCE_SECONDS) return null

  const payloadResult =
    PUBLIC_CAPABILITIES[capability].payloadSchema.safeParse(obj.payload)
  if (!payloadResult.success) return null

  return { payload: payloadResult.data as CapabilityPayload<C> }
}

interface CookieReader {
  get(name: string): { value: string } | undefined
}

/**
 * Convenience: look up the cookie by name, then verify. Returns `null` if the
 * cookie is missing, malformed, expired, or mismatched.
 */
export function readPublicCapabilityFromCookie<C extends CapabilityKey>(args: {
  cookies: CookieReader
  capability: C
  slug: string
  nowSeconds?: number
}): { payload: CapabilityPayload<C> } | null {
  const cookieName = publicCapabilityCookieName(args.capability, args.slug)
  const raw = args.cookies.get(cookieName)?.value ?? null
  if (!raw) return null
  return verifyPublicCapability({
    raw,
    capability: args.capability,
    slug: args.slug,
    nowSeconds: args.nowSeconds,
  })
}

interface CookieSetOptions {
  name: string
  value: string
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
  maxAge?: number
}

interface CookieWriter {
  set(opts: CookieSetOptions): void
}

/**
 * Set the cookie with the canonical attributes for a public capability:
 * HttpOnly, Secure (prod only), SameSite=Lax, Path=/, Max-Age=cap.ttlSeconds.
 *
 * Path is `/` because the cookie must cover both `/g/:slug/*` (tracking
 * pages) and `/api/g/:slug/*` (API routes). Cookie path matching is
 * prefix-based with no common prefix beyond `/`. Slug isolation stays intact
 * via the cookie name (one cookie per `(cap, slug)`) and the HMAC payload,
 * which rejects cross-slug values.
 */
export function setPublicCapabilityCookie(args: {
  response: { cookies: CookieWriter }
  capability: CapabilityKey
  slug: string
  signedValue: string
}): void {
  const { capability, slug, signedValue } = args
  args.response.cookies.set({
    name: publicCapabilityCookieName(capability, slug),
    value: signedValue,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PUBLIC_CAPABILITIES[capability].ttlSeconds,
  })
}

// Re-export the registry-side helper so call sites can narrow untrusted
// strings (e.g. cookie names extracted from a request) into `CapabilityKey`
// without importing two modules.
export { isRegisteredCapability }
