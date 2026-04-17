import type { FC } from "react";
import type { GuideResolverKey, GuideSection } from "@/lib/types/guide-tree";
import { SectionCard } from "./section-card";
import { GuideEmergencySection } from "./guide-emergency-section";

export type PublicSectionComponent = FC<{ section: GuideSection }>;

/** Maps a section's `resolverKey` to its renderer. The default `SectionCard`
 * covers "list of items + empty state"; specialized entries only exist when
 * the UX needs more (emergency = tappable phone/email). */
export const PUBLIC_GUIDE_SECTION_REGISTRY: Record<
  GuideResolverKey,
  PublicSectionComponent
> = {
  essentials: SectionCard,
  arrival: SectionCard,
  spaces: SectionCard,
  howto: SectionCard,
  amenities: SectionCard,
  rules: SectionCard,
  checkout: SectionCard,
  local: SectionCard,
  emergency: GuideEmergencySection,
};

export function getPublicSectionComponent(
  key: GuideResolverKey,
): PublicSectionComponent {
  return PUBLIC_GUIDE_SECTION_REGISTRY[key] ?? SectionCard;
}
