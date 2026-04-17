import type { FC } from "react";
import type { GuideResolverKey, GuideSection } from "@/lib/types/guide-tree";
import { SectionCard } from "./section-card";
import { GuideEmergencySection } from "./guide-emergency-section";
import { GuideLocalSection } from "./guide-local-section";

export type PublicSectionComponent = FC<{ section: GuideSection }>;

/**
 * Maps a section's `resolverKey` to the component that should render it on
 * `/g/:slug`. Add a new resolver key → register its component here.
 * The default `SectionCard` covers standard "list of items + empty state".
 * Specialized renderers only exist where the UX needs more than a list
 * (emergency = tappable phone/email, local = map surface in 13D).
 */
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
  local: GuideLocalSection,
  emergency: GuideEmergencySection,
};

export function getPublicSectionComponent(
  key: GuideResolverKey,
): PublicSectionComponent {
  return PUBLIC_GUIDE_SECTION_REGISTRY[key] ?? SectionCard;
}
