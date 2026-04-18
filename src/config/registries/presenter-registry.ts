import { contactPresenter } from "@/lib/presenters/contact-presenter";
import { genericTextPresenter } from "@/lib/presenters/generic-text-presenter";
import { policyPresenter } from "@/lib/presenters/policy-presenter";
import { rawSentinelPresenter } from "@/lib/presenters/raw-sentinel-presenter";
import type { Presenter } from "@/lib/presenters/types";

/** Presenter registry.
 *
 * Resolution cascade when normalizing a `GuideItem`:
 *   1. `taxonomyKey` null/empty → `genericTextPresenter` (derived items that
 *      carry no taxonomy identity by design).
 *   2. exact `taxonomyKey` match (`EXACT_PRESENTERS`).
 *   3. longest `taxonomyKey` prefix match (`PREFIX_PRESENTERS`).
 *   4. prefix in `FALLBACK_ALLOWED_PREFIXES` → `genericTextPresenter` (the
 *      upstream resolver already humanized `value`; no specialized presenter
 *      is needed).
 *   5. anything else → `rawSentinelPresenter` (emits `presentationType: "raw"`,
 *      hidden by the guest renderer + logged as `missing-presenter`).
 *
 * Adding a new presenter = register it here (exact or prefix). Adding a new
 * taxonomy family whose items need no humanization (values already carry the
 * human label) = extend `FALLBACK_ALLOWED_PREFIXES`. Renderers never import
 * presenters directly — they consume the already-normalized `displayValue` /
 * `displayFields`. */
const EXACT_PRESENTERS: Record<string, Presenter> = {};

interface PrefixRule {
  prefix: string;
  presenter: Presenter;
}

const PREFIX_PRESENTERS: PrefixRule[] = [
  { prefix: "pol.", presenter: policyPresenter },
  { prefix: "fee.", presenter: policyPresenter },
  { prefix: "ct.", presenter: contactPresenter },
];

/** Prefixes whose items legitimately fall back to `genericTextPresenter`
 * because the resolver already substitutes the taxonomy label into `value`
 * (e.g. `resolveSpaces` sets `value: typeItem.label`). Keeping the list
 * explicit makes the sentinel path live: a brand-new prefix is loud by
 * default. */
const FALLBACK_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  "sp.", // spaces (resolver humanizes via space_types taxonomy)
  "am.", // amenities + access methods (both resolvers humanize upstream)
  "lp.", // local places (resolver humanizes via category taxonomy)
];

// Longest-prefix-first so more specific rules win over broader ones.
const SORTED_PREFIX_PRESENTERS = [...PREFIX_PRESENTERS].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

export function getPresenter(taxonomyKey: string | null | undefined): Presenter {
  if (!taxonomyKey) return genericTextPresenter;
  const exact = EXACT_PRESENTERS[taxonomyKey];
  if (exact) return exact;
  for (const rule of SORTED_PREFIX_PRESENTERS) {
    if (taxonomyKey.startsWith(rule.prefix)) return rule.presenter;
  }
  for (const allowed of FALLBACK_ALLOWED_PREFIXES) {
    if (taxonomyKey.startsWith(allowed)) return genericTextPresenter;
  }
  return rawSentinelPresenter;
}

/** Exposed for coverage tests (`presenter-coverage.test.ts`). */
export function listRegisteredPrefixes(): ReadonlyArray<string> {
  return SORTED_PREFIX_PRESENTERS.map((r) => r.prefix);
}

export function listRegisteredExactKeys(): ReadonlyArray<string> {
  return Object.keys(EXACT_PRESENTERS);
}

export function listFallbackAllowedPrefixes(): ReadonlyArray<string> {
  return FALLBACK_ALLOWED_PREFIXES;
}
