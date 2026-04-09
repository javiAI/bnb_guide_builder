/**
 * Renderer registry.
 *
 * Defines how domain data is rendered across output targets:
 * guest guide, AI/LLM view, internal view, and messaging.
 *
 * All renderers consume the same normalized domain model
 * (KnowledgeItem, GuideSection, MessageTemplate) — they do NOT
 * maintain separate ad-hoc data structures.
 *
 * This registry maps section keys to their rendering configuration,
 * ensuring consistency across all output surfaces.
 */

export type OutputTarget = "guest_guide" | "ai_view" | "internal" | "messaging";

export interface RenderConfig {
  /** Section key from section-editors registry */
  sectionKey: string;
  /** Which output targets include this section */
  targets: OutputTarget[];
  /** Visibility level constraint */
  maxVisibility: "public" | "booked_guest" | "internal";
  /** Whether to include media assets in output */
  includeMedia: boolean;
  /** Guide section type for composition */
  guideSectionType?: string;
  /** Knowledge item category for AI retrieval */
  knowledgeCategory?: string;
}

export const RENDER_CONFIGS: RenderConfig[] = [
  {
    sectionKey: "basics",
    targets: ["guest_guide", "ai_view", "internal"],
    maxVisibility: "public",
    includeMedia: true,
    guideSectionType: "property_overview",
    knowledgeCategory: "property_info",
  },
  {
    sectionKey: "arrival",
    targets: ["guest_guide", "ai_view", "internal", "messaging"],
    maxVisibility: "booked_guest",
    includeMedia: true,
    guideSectionType: "arrival",
    knowledgeCategory: "check_in",
  },
  {
    sectionKey: "policies",
    targets: ["guest_guide", "ai_view", "internal", "messaging"],
    maxVisibility: "booked_guest",
    includeMedia: false,
    guideSectionType: "house_rules",
    knowledgeCategory: "policies",
  },
  {
    sectionKey: "spaces",
    targets: ["guest_guide", "ai_view", "internal"],
    maxVisibility: "public",
    includeMedia: true,
    guideSectionType: "spaces",
    knowledgeCategory: "spaces",
  },
  {
    sectionKey: "amenities",
    targets: ["guest_guide", "ai_view", "internal"],
    maxVisibility: "public",
    includeMedia: true,
    guideSectionType: "amenities",
    knowledgeCategory: "amenities",
  },
  {
    sectionKey: "troubleshooting",
    targets: ["ai_view", "internal", "messaging"],
    maxVisibility: "booked_guest",
    includeMedia: true,
    guideSectionType: "troubleshooting",
    knowledgeCategory: "troubleshooting",
  },
  {
    sectionKey: "local-guide",
    targets: ["guest_guide", "ai_view"],
    maxVisibility: "public",
    includeMedia: true,
    guideSectionType: "local_recommendations",
    knowledgeCategory: "local_guide",
  },
];

export function getRenderConfig(sectionKey: string): RenderConfig | undefined {
  return RENDER_CONFIGS.find((c) => c.sectionKey === sectionKey);
}

export function getRenderConfigsForTarget(target: OutputTarget): RenderConfig[] {
  return RENDER_CONFIGS.filter((c) => c.targets.includes(target));
}
