import { contactPresenter } from "@/lib/presenters/contact-presenter";
import { genericTextPresenter } from "@/lib/presenters/generic-text-presenter";
import { policyPresenter } from "@/lib/presenters/policy-presenter";
import type { Presenter } from "@/lib/presenters/types";

/** Presenter registry.
 *
 * Resolution cascade when normalizing a `GuideItem`:
 *   1. exact `taxonomyKey` match (`EXACT_PRESENTERS`)
 *   2. longest `taxonomyKey` prefix match (`PREFIX_PRESENTERS`)
 *   3. fallback to `genericTextPresenter`
 *
 * Adding a new presenter = register it here (exact or prefix). Renderers never
 * import presenters directly — they consume the already-normalized
 * `displayValue` / `displayFields`. */
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

// Longest-prefix-first so more specific rules win over broader ones.
const SORTED_PREFIX_PRESENTERS = [...PREFIX_PRESENTERS].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

export function getPresenter(taxonomyKey: string | null | undefined): Presenter {
  if (taxonomyKey) {
    const exact = EXACT_PRESENTERS[taxonomyKey];
    if (exact) return exact;
    for (const rule of SORTED_PREFIX_PRESENTERS) {
      if (taxonomyKey.startsWith(rule.prefix)) return rule.presenter;
    }
  }
  return genericTextPresenter;
}

/** Exposed for coverage tests (`presenter-coverage.test.ts`). */
export function listRegisteredPrefixes(): ReadonlyArray<string> {
  return SORTED_PREFIX_PRESENTERS.map((r) => r.prefix);
}

export function listRegisteredExactKeys(): ReadonlyArray<string> {
  return Object.keys(EXACT_PRESENTERS);
}
