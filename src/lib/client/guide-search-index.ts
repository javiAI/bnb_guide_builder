import Fuse, { type IFuseOptions } from "fuse.js";
import type {
  GuideSearchEntry,
  GuideSearchIndex,
} from "@/lib/types/guide-search-hit";

// Centralised Fuse options — threshold and weighted keys were frozen in
// MASTER_PLAN_V2 Fase -1 (2026-04-17). Any change here is a product
// decision, not an implementation detail: it shifts every hit's ranking.
export const FUSE_OPTIONS: IFuseOptions<GuideSearchEntry> = {
  threshold: 0.35,
  ignoreDiacritics: true,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
  keys: [
    { name: "label", weight: 2 },
    { name: "snippet", weight: 1.5 },
    { name: "keywords", weight: 1 },
  ],
};

/** Thin factory — the index itself is built server-side; the client only
 * deserializes the payload and constructs a Fuse instance. Kept separate
 * so the client never imports the server builder (which uses `node:crypto`). */
export function createFuseFromIndex(
  index: GuideSearchIndex,
): Fuse<GuideSearchEntry> {
  return new Fuse(index.entries, FUSE_OPTIONS);
}
