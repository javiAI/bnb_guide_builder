/**
 * Media requirements registry.
 *
 * Provides a typed API over the media_requirements taxonomy.
 * Forms, validation, preview, and publishing checks all consume
 * this same source of truth — no separate ad-hoc media configs.
 *
 * Adding media requirements for a new amenity or section:
 * 1. Add entry in taxonomies/media_requirements.json
 * 2. This registry picks it up automatically
 * 3. Forms and validators will reference the new requirement
 */

import { mediaRequirements, getItems, findItem } from "@/lib/taxonomy-loader";
import type { TaxonomyItem } from "@/lib/types/taxonomy";

/** Extended item with media-specific fields present in the JSON */
interface MediaItem extends TaxonomyItem {
  section?: string;
  entity?: string;
  required_level?: string;
  media_type?: string;
  objective?: string;
  capture_instructions?: string;
}

function asMedia(item: TaxonomyItem): MediaItem {
  return item as MediaItem;
}

/**
 * Get all media requirements for a given section.
 */
export function getMediaRequirementsForSection(sectionKey: string): MediaItem[] {
  return getItems(mediaRequirements)
    .map(asMedia)
    .filter((item) => item.section === sectionKey);
}

/**
 * Get a specific media requirement by ID.
 */
export function getMediaRequirement(id: string): MediaItem | undefined {
  const item = findItem(mediaRequirements, id);
  return item ? asMedia(item) : undefined;
}

/**
 * Get all required media items (required_level = "required").
 */
export function getRequiredMedia(): MediaItem[] {
  return getItems(mediaRequirements)
    .map(asMedia)
    .filter((item) => item.required_level === "required");
}

/**
 * Get all recommended media items (required_level = "recommended").
 */
export function getRecommendedMedia(): MediaItem[] {
  return getItems(mediaRequirements)
    .map(asMedia)
    .filter((item) => item.required_level === "recommended");
}

/**
 * Check if all required media for a section is satisfied.
 */
export function validateSectionMedia(
  sectionKey: string,
  uploadedMediaIds: string[],
): { complete: boolean; missing: MediaItem[] } {
  const required = getMediaRequirementsForSection(sectionKey).filter(
    (item) => item.required_level === "required",
  );

  const missing = required.filter((item) => !uploadedMediaIds.includes(item.id));

  return {
    complete: missing.length === 0,
    missing,
  };
}
