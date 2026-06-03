/**
 * System relevance — first instance of the conditional-relevance pattern for
 * systems/amenities (FUTURE §28). A system item is "relevant" for a property
 * when its optional `relevantWhen` rule is satisfied by the property context
 * (or when it has no rule at all). Reuses the same engine as space/amenity
 * availability — no bespoke evaluator.
 *
 * Today only `sys.elevator` carries a `relevantWhen` (multi-floor, non-house).
 * The full rollout (every system/amenity, editors filtering by relevance,
 * completeness ignoring irrelevant items) is deferred to a dedicated branch.
 */

import { evaluateItemAvailability } from "@/lib/conditional-engine/evaluator";
import type { PropertyContext } from "@/lib/conditional-engine/types";
import type { SystemItem } from "@/lib/types/taxonomy";

export function isSystemRelevant(item: SystemItem, ctx: PropertyContext): boolean {
  return evaluateItemAvailability(item.relevantWhen ?? null, ctx).available;
}

export function getRelevantSystems(items: SystemItem[], ctx: PropertyContext): SystemItem[] {
  return items.filter((item) => isSystemRelevant(item, ctx));
}
