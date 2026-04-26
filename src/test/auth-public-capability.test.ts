// Public guide capability primitive (Rama 15C). Generalizes the slug-scoped
// HMAC pattern from Rama 13D and is the only authorizer for guest-side
// reads of guest-originated state (`GET /api/g/:slug/incidents/:id` today,
// future capabilities tomorrow). If these invariants relax, any guest could
// enumerate state by id, or capability X cookies could authorize capability
// Y verifications, or slug A cookies could authorize slug B reads.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'

import {
  signPublicCapability,
  verifyPublicCapability,
  publicCapabilityCookieName,
  readPublicCapabilityFromCookie,
  setPublicCapabilityCookie,
  isRegisteredCapability,
} from '@/lib/auth/public-capability'

import {
  PUBLIC_CAPABILITIES,
  PUBLIC_CAPABILITY_VERSION,
  MAX_INCIDENT_IDS_PER_COOKIE,
  DEFAULT_CAPABILITY_TTL_SECONDS,
} from '@/lib/auth/public-capability-registry'

// Mirrors the production `getSecret()` resolution so forged envelopes verify
// against whatever the runtime is actually using (env var when set, dev
// fallback otherwise).
function resolveTestSecret(): string {
  const env = process.env.PUBLIC_CAPABILITY_SECRET
  if (env && env.length >= 16) return env
  return 'dev-only-public-capability-secret-do-not-use-in-prod'
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Forge an envelope with arbitrary fields. Used to test that verify rejects
 *  envelopes the legitimate signer would never produce (cap mismatch, version
 *  mismatch, unknown cap key, payload schema violation) — the signature is
 *  cryptographically valid against the same secret, so all rejections come
 *  from the binding/schema checks, not from sig failure. */
function forgeEnvelope(envelope: Record<string, unknown>): string {
  const envelopeB64 = base64urlEncode(JSON.stringify(envelope))
  const sig = createHmac('sha256', resolveTestSecret())
    .update(envelopeB64)
    .digest()
  const sigB64 = sig
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${envelopeB64}.${sigB64}`
}

describe('public-capability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Round-trip + tampering invariants (ported from Rama 13D)
  // -------------------------------------------------------------------------

  describe('round-trip', () => {
    it('signs and verifies a valid envelope', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1', 'inc2'] },
      })
      expect(signed).toContain('.')
      expect(signed.split('.').length).toBe(2)

      const verified = verifyPublicCapability({
        raw: signed,
        capability: 'incident_read',
        slug: 'sunset-villa',
      })
      expect(verified).not.toBeNull()
      expect(verified?.payload.ids).toEqual(['inc1', 'inc2'])
    })

    it('returns null for a malformed envelope (no dot)', () => {
      expect(
        verifyPublicCapability({
          raw: 'no-dot-here',
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })

    it('returns null for an envelope with empty signature', () => {
      expect(
        verifyPublicCapability({
          raw: 'somepayload.',
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })
  })

  describe('cross-slug isolation', () => {
    it('rejects an envelope signed for a different slug', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      expect(
        verifyPublicCapability({
          raw: signed,
          capability: 'incident_read',
          slug: 'other-slug',
        }),
      ).toBeNull()
    })
  })

  describe('signature tampering', () => {
    it('rejects a tampered signature', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      const [payload, sig] = signed.split('.')
      const tampered = `${payload}.${sig.slice(0, -2)}aa`
      expect(
        verifyPublicCapability({
          raw: tampered,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })

    it('rejects a tampered payload (keeps original signature)', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      const [payload, sig] = signed.split('.')
      // flip one char in payload
      const tamperedPayload = payload.replace(/.$/, (c) =>
        c === 'A' ? 'B' : 'A',
      )
      expect(
        verifyPublicCapability({
          raw: `${tamperedPayload}.${sig}`,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })
  })

  describe('TTL + clock skew', () => {
    it('rejects envelopes older than the per-capability TTL', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      vi.setSystemTime(
        new Date('2026-04-26T12:00:00Z').getTime() +
          (DEFAULT_CAPABILITY_TTL_SECONDS + 10) * 1000,
      )
      expect(
        verifyPublicCapability({
          raw: signed,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })

    it('accepts envelopes inside the TTL window', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      vi.setSystemTime(
        new Date('2026-04-26T12:00:00Z').getTime() +
          (DEFAULT_CAPABILITY_TTL_SECONDS - 60) * 1000,
      )
      expect(
        verifyPublicCapability({
          raw: signed,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).not.toBeNull()
    })

    it('rejects envelopes whose iat is more than 5 min in the future', () => {
      vi.setSystemTime(new Date('2026-04-26T12:00:00Z'))
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      // move the clock backwards by 10 min — the envelope's iat is now 10 min
      // in the future. The clock-skew guard rejects anything > 5 min ahead.
      vi.setSystemTime(new Date('2026-04-26T11:50:00Z'))
      expect(
        verifyPublicCapability({
          raw: signed,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })

    it('accepts envelopes within the 5 min clock-skew tolerance', () => {
      vi.setSystemTime(new Date('2026-04-26T12:00:00Z'))
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      // move the clock back by 4 min — the envelope's iat is 4 min ahead,
      // inside the 5 min tolerance.
      vi.setSystemTime(new Date('2026-04-26T11:56:00Z'))
      expect(
        verifyPublicCapability({
          raw: signed,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // 15C-specific invariants (cross-capability, version, schema, registry)
  // -------------------------------------------------------------------------

  describe('cross-capability isolation', () => {
    it('rejects an envelope whose cap field does not match the verify capability', () => {
      // Forged envelope claims cap='guide_feedback' (an unregistered, candidate
      // future cap) but is being verified as 'incident_read'. Even though the
      // signature is valid against the shared secret, the cap-binding check
      // rejects it.
      const forged = forgeEnvelope({
        cap: 'guide_feedback',
        slug: 'sunset-villa',
        iat: Math.floor(Date.now() / 1000),
        payload: { ids: ['inc1'] },
        v: PUBLIC_CAPABILITY_VERSION,
      })
      expect(
        verifyPublicCapability({
          raw: forged,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })

    it('rejects an envelope with a non-string cap field', () => {
      const forged = forgeEnvelope({
        cap: 42,
        slug: 'sunset-villa',
        iat: Math.floor(Date.now() / 1000),
        payload: { ids: ['inc1'] },
        v: PUBLIC_CAPABILITY_VERSION,
      })
      expect(
        verifyPublicCapability({
          raw: forged,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })
  })

  describe('envelope version', () => {
    it('rejects an envelope with the wrong version', () => {
      const forged = forgeEnvelope({
        cap: 'incident_read',
        slug: 'sunset-villa',
        iat: Math.floor(Date.now() / 1000),
        payload: { ids: ['inc1'] },
        v: PUBLIC_CAPABILITY_VERSION + 1,
      })
      expect(
        verifyPublicCapability({
          raw: forged,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })

    it('rejects an envelope with a missing version', () => {
      const forged = forgeEnvelope({
        cap: 'incident_read',
        slug: 'sunset-villa',
        iat: Math.floor(Date.now() / 1000),
        payload: { ids: ['inc1'] },
      })
      expect(
        verifyPublicCapability({
          raw: forged,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })
  })

  describe('payload schema', () => {
    it('throws at sign time on payload that violates the per-cap schema', () => {
      // Array length is checked at runtime by Zod, not by the static type — the
      // cap of MAX_INCIDENT_IDS_PER_COOKIE is enforced via `.max()` and surfaces
      // at sign time as a thrown ZodError.
      expect(() =>
        signPublicCapability({
          capability: 'incident_read',
          slug: 'sunset-villa',
          payload: { ids: Array.from({ length: 11 }, (_, i) => `inc${i}`) },
        }),
      ).toThrow()
    })

    it('rejects at verify time a forged envelope with invalid payload shape', () => {
      const forged = forgeEnvelope({
        cap: 'incident_read',
        slug: 'sunset-villa',
        iat: Math.floor(Date.now() / 1000),
        payload: { ids: 'not-an-array' },
        v: PUBLIC_CAPABILITY_VERSION,
      })
      expect(
        verifyPublicCapability({
          raw: forged,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })

    it('rejects at verify time a forged envelope whose ids exceed the cap', () => {
      const forged = forgeEnvelope({
        cap: 'incident_read',
        slug: 'sunset-villa',
        iat: Math.floor(Date.now() / 1000),
        payload: {
          ids: Array.from(
            { length: MAX_INCIDENT_IDS_PER_COOKIE + 1 },
            (_, i) => `inc${i}`,
          ),
        },
        v: PUBLIC_CAPABILITY_VERSION,
      })
      expect(
        verifyPublicCapability({
          raw: forged,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Cookie helpers
  // -------------------------------------------------------------------------

  describe('publicCapabilityCookieName', () => {
    it('namespaces by slug', () => {
      expect(publicCapabilityCookieName('incident_read', 'a')).not.toBe(
        publicCapabilityCookieName('incident_read', 'b'),
      )
    })

    it('embeds slug and capability in the cookie name', () => {
      const name = publicCapabilityCookieName('incident_read', 'sunset-villa')
      expect(name).toContain('incident_read')
      expect(name).toContain('sunset-villa')
      expect(name.startsWith('gc-')).toBe(true)
    })

    it('produces RFC 6265 token-safe names for sample slugs', () => {
      const tokenSafe = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/
      for (const slug of [
        'sunset-villa',
        'a',
        'casa-marbella-2',
        'apt.5b',
      ]) {
        expect(tokenSafe.test(publicCapabilityCookieName('incident_read', slug)))
          .toBe(true)
      }
    })
  })

  describe('readPublicCapabilityFromCookie', () => {
    it('reads and verifies in one call', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      const cookies = {
        get: (name: string) =>
          name === publicCapabilityCookieName('incident_read', 'sunset-villa')
            ? { value: signed }
            : undefined,
      }
      const verified = readPublicCapabilityFromCookie({
        cookies,
        capability: 'incident_read',
        slug: 'sunset-villa',
      })
      expect(verified?.payload.ids).toEqual(['inc1'])
    })

    it('returns null when the cookie is missing', () => {
      const cookies = { get: () => undefined }
      const verified = readPublicCapabilityFromCookie({
        cookies,
        capability: 'incident_read',
        slug: 'sunset-villa',
      })
      expect(verified).toBeNull()
    })

    it('returns null when the cookie name matches a different slug', () => {
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'other-slug',
        payload: { ids: ['inc1'] },
      })
      // Only the `other-slug`-named cookie is present; reader asks for the
      // `sunset-villa` cookie, which does not exist on this client.
      const cookies = {
        get: (name: string) =>
          name === publicCapabilityCookieName('incident_read', 'other-slug')
            ? { value: signed }
            : undefined,
      }
      expect(
        readPublicCapabilityFromCookie({
          cookies,
          capability: 'incident_read',
          slug: 'sunset-villa',
        }),
      ).toBeNull()
    })
  })

  describe('setPublicCapabilityCookie', () => {
    it('sets the canonical cookie attributes', () => {
      interface CapturedOpts {
        name: string
        value: string
        path?: string
        httpOnly?: boolean
        secure?: boolean
        sameSite?: 'lax' | 'strict' | 'none'
        maxAge?: number
      }
      const captured: CapturedOpts[] = []
      const response = {
        cookies: {
          set: (opts: CapturedOpts) => {
            captured.push(opts)
          },
        },
      }
      const signed = signPublicCapability({
        capability: 'incident_read',
        slug: 'sunset-villa',
        payload: { ids: ['inc1'] },
      })
      setPublicCapabilityCookie({
        response,
        capability: 'incident_read',
        slug: 'sunset-villa',
        signedValue: signed,
      })
      expect(captured.length).toBe(1)
      const opts = captured[0]
      expect(opts.name).toBe(
        publicCapabilityCookieName('incident_read', 'sunset-villa'),
      )
      expect(opts.value).toBe(signed)
      expect(opts.httpOnly).toBe(true)
      expect(opts.sameSite).toBe('lax')
      expect(opts.path).toBe('/')
      expect(opts.maxAge).toBe(PUBLIC_CAPABILITIES.incident_read.ttlSeconds)
    })
  })

  // -------------------------------------------------------------------------
  // Registry coverage
  // -------------------------------------------------------------------------

  describe('registry', () => {
    it('declares incident_read as the only capability in 15C', () => {
      expect(Object.keys(PUBLIC_CAPABILITIES).sort()).toEqual([
        'incident_read',
      ])
    })

    it('every entry uses RFC 6265 token-safe characters', () => {
      const tokenSafe = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/
      for (const k of Object.keys(PUBLIC_CAPABILITIES)) {
        expect(tokenSafe.test(k)).toBe(true)
      }
    })

    it('isRegisteredCapability narrows known keys', () => {
      expect(isRegisteredCapability('incident_read')).toBe(true)
      expect(isRegisteredCapability('guide_feedback')).toBe(false)
      expect(isRegisteredCapability('')).toBe(false)
    })
  })
})
