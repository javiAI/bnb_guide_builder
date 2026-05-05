// Re-export from the canonical loader so every consumer goes through the
// eager Zod validation in `taxonomy-loader.ts`. The loader runs at module
// import time, throws on invalid JSON, and rejects duplicate ids — bypassing
// it via a hand-rolled `as unknown as` cast (the previous shape of this file)
// is exactly the fragility the per-domain modules were originally meant to
// avoid.
export {
  localPlaceCategories,
  findLocalPlaceCategory,
  isLocalPlaceCategoryKey,
} from "@/lib/taxonomy-loader";
export type {
  LocalPlaceCategory,
  LocalPlaceCategoriesFile,
} from "@/lib/taxonomy-loader";
