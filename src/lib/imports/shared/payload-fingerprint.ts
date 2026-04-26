import { createHash } from "node:crypto";

import type { ResolutionStrategy } from "./apply-strategies";

export interface FingerprintInput {
  platform: "airbnb" | "booking";
  payload: unknown;
  resolutions: Record<string, ResolutionStrategy>;
}

/**
 * Stable identifier for an apply attempt. SHA-256 of canonical-JSON
 * (lexicographically sorted keys) of `{platform, payload, resolutions}`,
 * truncated to 16 hex chars. 64 bits of entropy is sufficient for
 * idempotency lookups within a single property's audit log.
 *
 * Determinism is the only contract here — same input → same output
 * across processes and node versions.
 */
export function computePayloadFingerprint(input: FingerprintInput): string {
  const canonical = canonicalize({
    platform: input.platform,
    payload: input.payload,
    resolutions: input.resolutions,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}
