/**
 * Public guide capabilities — typed registry (Rama 15C).
 *
 * # Why TS const and not JSON taxonomy
 *
 * The repo uses `taxonomies/*.json` for content models (amenities, places,
 * incident categories, policies, etc.) loaded at boot via Zod-validated
 * loaders. Capabilities deliberately live in TS, not JSON, for four reasons:
 *
 * 1. Infrastructure code-coupled. Every capability declared here requires one
 *    or more TS call sites that sign or verify against it. Registry and
 *    consumer are bound by contract; there is no "data evolves without code"
 *    decoupling like there is for amenities (the taxonomy can grow without
 *    touching UI). A new capability is always a coordinated PR that adds an
 *    entry here AND wires up consumers in the same change.
 *
 * 2. Not editable by operators. JSON taxonomies model the product domain
 *    (what amenities exist, what categories of incident exist). Capabilities
 *    model the authorization mechanism (how a guest is authorized to perform
 *    action X). No operator, host, or non-engineer ever edits capabilities —
 *    they only change with a code PR.
 *
 * 3. Content vs mechanism. Mutating a capability without touching the code
 *    that consumes it breaks at runtime as tampered-cookie / silent-drop.
 *    Mutating an amenity in JSON only affects render output. The change
 *    regimes are different, and the storage should reflect that.
 *
 * 4. Per-capability type inference. `CapabilityPayload<C>` resolves at compile
 *    time to the exact payload shape declared for capability C. A JSON loader
 *    would return `unknown` and force manual casts at every call site, losing
 *    cross-capability isolation guarantees at the type level.
 *
 * The coverage test (`public-capability.test.ts`) asserts that every
 * `signPublicCapability({capability, ...})` call site references a key
 * present in `PUBLIC_CAPABILITIES`. Same principle as `field-type-coverage.test.ts`.
 */

import { z } from 'zod'

/**
 * Envelope schema version. Bump when the on-the-wire envelope shape changes
 * (e.g. additional binding fields, signature algorithm change). `verifyPublicCapability`
 * rejects any envelope whose `v` does not equal this constant — old cookies
 * become invalid at the same instant production switches.
 */
export const PUBLIC_CAPABILITY_VERSION = 1

/** Default TTL applied to capabilities that don't override `ttlSeconds`. */
export const DEFAULT_CAPABILITY_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * Hard cap on the size of `incident_read.payload.ids`. A single guest stay
 * never legitimately produces more than a handful of incidents; the cap blocks
 * a malicious client from pumping arbitrary amounts of data into our headers
 * and bounds the verify-time payload-schema work.
 */
export const MAX_INCIDENT_IDS_PER_COOKIE = 10

/**
 * Capability descriptor. The generic `P` is the payload shape; `payloadSchema`
 * is the runtime validator that gates both sign and verify. TTL is per-cap so
 * different surfaces can pick different windows (e.g. a `booking_extension_request`
 * capability would likely use 24h, not 7d).
 */
interface CapabilityDescriptor<P> {
  readonly ttlSeconds: number
  readonly payloadSchema: z.ZodType<P>
}

/**
 * Active capability registry.
 *
 * 15C ships with a single capability — `incident_read` — which is the only one
 * with a runtime consumer (the `GET /api/g/:slug/incidents/:id` authorizer
 * migrated from Rama 13D). New capabilities land one-by-one with their consumer
 * in the same PR; never speculatively. See SECURITY_AND_AUDIT.md §0.5 for
 * the catalog policy and the list of deferred candidates.
 */
export const PUBLIC_CAPABILITIES = {
  incident_read: {
    ttlSeconds: DEFAULT_CAPABILITY_TTL_SECONDS,
    payloadSchema: z
      .object({
        ids: z.array(z.string().min(1)).max(MAX_INCIDENT_IDS_PER_COOKIE),
      })
      .strict(),
  },
} as const satisfies Record<string, CapabilityDescriptor<unknown>>

export type CapabilityKey = keyof typeof PUBLIC_CAPABILITIES

export type CapabilityPayload<C extends CapabilityKey> = z.infer<
  (typeof PUBLIC_CAPABILITIES)[C]['payloadSchema']
>

/**
 * Returns true iff `key` is a registered capability. Use this when consuming
 * untrusted strings (e.g. cookie names extracted from a request) before
 * narrowing into the typed API. Unregistered keys never reach sign/verify.
 */
export function isRegisteredCapability(key: string): key is CapabilityKey {
  return Object.prototype.hasOwnProperty.call(PUBLIC_CAPABILITIES, key)
}
