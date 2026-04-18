import type {
  GuideAudience,
  GuideItem,
  GuideItemDisplayField,
  GuidePresentationType,
} from "@/lib/types/guide-tree";

export interface PresenterOutput {
  presentationType: GuidePresentationType;
  displayValue: string;
  displayFields: GuideItemDisplayField[];
  warnings: string[];
}

export type Presenter = (item: GuideItem, audience: GuideAudience) => PresenterOutput;

/** Matches taxonomy keys like `ct.host`, `pol.max_guests`, `am.wifi`,
 * `rm.smoking_outdoor_only`. Any display string that matches is treated as a
 * leak and replaced (QA_AND_RELEASE §3 invariant 2). */
export const TAXONOMY_KEY_PATTERN = /^[a-z]+(_[a-z]+)*\.[a-z_]+$/;

/** Values starting with these characters are suspected raw JSON blobs
 * (QA_AND_RELEASE §3 invariant 1). */
export function looksLikeRawJson(value: string): boolean {
  const trimmed = value.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
