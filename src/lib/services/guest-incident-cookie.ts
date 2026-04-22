/**
 * Slug-scoped, HMAC-signed cookie that authorizes a guest to read the status
 * of the incidents they reported via the public guide (Rama 13D).
 *
 * Design:
 *   - One cookie per slug (`guide-incidents:<slug>`). Isolating per-slug means
 *     a device that has the guide open for two different properties never
 *     lets one property's guest read the other's incidents.
 *   - Payload is a JSON object `{ slug, ids, iat }` with `ids` capped at 10
 *     (a single stay never legitimately produces more than a handful; the cap
 *     blocks a malicious client from pumping arbitrary amounts of data into
 *     our headers).
 *   - HMAC-SHA256 over the raw payload bytes with `GUEST_INCIDENT_COOKIE_SECRET`.
 *     Signature is validated with `timingSafeEqual` — constant time.
 *   - TTL 7 days. Rotating the secret invalidates outstanding track URLs,
 *     which is intentional: guests can always report a new incident.
 *   - On tampering/expiry we DROP the cookie (treat as if missing). We never
 *      403 on cookie errors because the track URL is public — the cookie only
 *     *adds* read authority; lacking it just means the guest can't see status.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_INCIDENT_COOKIE_PREFIX = "guide-incidents:";
export const GUEST_INCIDENT_COOKIE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_IDS_PER_COOKIE = 10;

interface CookiePayload {
  slug: string;
  ids: string[];
  iat: number;
}

function getSecret(): string {
  const secret = process.env.GUEST_INCIDENT_COOKIE_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GUEST_INCIDENT_COOKIE_SECRET must be set (≥16 chars) in production",
    );
  }
  // Dev/test fallback. Deterministic so cookies survive server restart during
  // local development; never used in prod (the branch above throws first).
  return "dev-only-guest-incident-cookie-secret-do-not-use-in-prod";
}

function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecodeToString(input: string): string | null {
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return Buffer.from(padded + pad, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function hmacDigest(payload: string): Buffer {
  return createHmac("sha256", getSecret()).update(payload).digest();
}

export function buildGuestIncidentCookieValue(
  slug: string,
  ids: readonly string[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const deduped = Array.from(new Set(ids)).slice(-MAX_IDS_PER_COOKIE);
  const payload: CookiePayload = { slug, ids: deduped, iat: nowSeconds };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(payloadJson);
  // Sign the already-encoded payload so verification doesn't need to re-encode
  // (any whitespace/key-order variance between encoder and verifier would
  // silently invalidate cookies).
  const sigB64 = base64urlEncode(hmacDigest(payloadB64));
  return `${payloadB64}.${sigB64}`;
}

export function parseGuestIncidentCookieValue(
  raw: string,
  expectedSlug: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): { ids: string[] } | null {
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;
  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  // Verify signature over the encoded payload (see `buildGuestIncidentCookieValue`).
  const expectedSig = hmacDigest(payloadB64);
  const providedPadded = sigB64.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    providedPadded.length % 4 === 0
      ? ""
      : "=".repeat(4 - (providedPadded.length % 4));
  let provided: Buffer;
  try {
    provided = Buffer.from(providedPadded + pad, "base64");
  } catch {
    return null;
  }
  if (provided.length !== expectedSig.length) return null;
  if (!timingSafeEqual(provided, expectedSig)) return null;

  const json = base64urlDecodeToString(payloadB64);
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.slug !== "string" || obj.slug !== expectedSlug) return null;
  if (typeof obj.iat !== "number" || !Number.isFinite(obj.iat)) return null;
  if (nowSeconds - obj.iat > GUEST_INCIDENT_COOKIE_TTL_SECONDS) return null;
  // Clock skew guard: cookies minted in the future beyond 5 min are junk.
  if (obj.iat - nowSeconds > 300) return null;
  if (!Array.isArray(obj.ids)) return null;
  const ids = obj.ids.filter((v): v is string => typeof v === "string");
  return { ids };
}

/** Merge a newly reported incident id into an existing cookie value (or
 *  create a new one if `existingCookieRaw` is null/invalid). Returns the
 *  fresh cookie string ready for `Set-Cookie`. */
export function appendIncidentIdToCookie(
  slug: string,
  existingCookieRaw: string | null,
  newIncidentId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const prev = existingCookieRaw
    ? parseGuestIncidentCookieValue(existingCookieRaw, slug, nowSeconds)
    : null;
  const nextIds = prev ? [...prev.ids, newIncidentId] : [newIncidentId];
  return buildGuestIncidentCookieValue(slug, nextIds, nowSeconds);
}

/** Constant used by the API routes when setting/reading the cookie. */
export function guestIncidentCookieName(slug: string): string {
  return `${GUEST_INCIDENT_COOKIE_PREFIX}${slug}`;
}
