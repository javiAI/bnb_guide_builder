import { describe, it, expect } from "vitest";

import airbnbAmenities from "../../taxonomies/platform-catalogs/airbnb-amenities.json";
import bookingAmenities from "../../taxonomies/platform-catalogs/booking-amenities.json";
import airbnbPropertyTypes from "../../taxonomies/platform-catalogs/airbnb-property-types.json";
import bookingPropertyTypes from "../../taxonomies/platform-catalogs/booking-property-types.json";
import airbnbAccessMethods from "../../taxonomies/platform-catalogs/airbnb-access-methods.json";
import airbnbStructuredFields from "../../taxonomies/platform-catalogs/airbnb-structured-fields.json";
import bookingStructuredFields from "../../taxonomies/platform-catalogs/booking-structured-fields.json";

import {
  amenityTaxonomy,
  propertyTypes,
  spaceTypes,
  accessMethods,
  policyTaxonomy,
  type MappableTaxonomy,
} from "@/lib/taxonomy-loader";
import type {
  TaxonomyItem,
  PlatformMapping,
  PlatformId,
} from "@/lib/types/taxonomy";

// ── Reverse coverage invariant (rama 14A) ──
//
// The forward gate (`platform-mappings-coverage.test.ts`) checks that every
// taxonomy item is mapped or `platform_supported:false`. That catches
// internal ambiguity but NOT gaps: if Airbnb publishes an amenity ID that no
// taxonomy item references, the forward gate never fires.
//
// This reverse gate checks the opposite direction: every entry we declare
// `relevance: "covered"` in the pinned catalogs / manifests under
// `taxonomies/platform-catalogs/` MUST be referenced by at least one taxonomy
// item's `source[]` — otherwise we claim coverage we don't actually have.
//
// Catalogs (external vocabulary pinned from the platform):
// - airbnb-amenities.json, booking-amenities.json
// - airbnb-property-types.json, booking-property-types.json
// - airbnb-access-methods.json
//
// Manifests (our declaration — not an external catalog):
// - airbnb-structured-fields.json, booking-structured-fields.json

const NORMALIZED_REASONS = new Set([
  "hotel_only",
  "deprecated",
  "duplicate",
  "not_relevant_to_str",
  "covered_via_alias",
  "platform_not_actionable",
]);

const ALLOWED_RELEVANCE = new Set(["covered", "out_of_scope"]);

const CLASSIFIABLE: Record<MappableTaxonomy, TaxonomyItem[]> = {
  amenities: amenityTaxonomy.items,
  property_types: propertyTypes.items,
  space_types: spaceTypes.items,
  access_methods: accessMethods.items,
  policies: policyTaxonomy.groups.flatMap((g) =>
    Array.isArray(g.items) ? g.items : [],
  ),
};

function findItemById(
  taxonomy: MappableTaxonomy,
  id: string,
): TaxonomyItem | undefined {
  return CLASSIFIABLE[taxonomy].find((i) => i.id === id);
}

function hasExternalId(
  items: TaxonomyItem[],
  platform: PlatformId,
  extId: string,
): boolean {
  for (const item of items) {
    const src = item.source;
    if (!Array.isArray(src)) continue;
    for (const entry of src) {
      if (typeof entry !== "object" || entry === null) continue;
      const m = entry as PlatformMapping;
      if (
        m.platform === platform &&
        m.kind === "external_id" &&
        m.external_id === extId
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasStructuredField(
  items: TaxonomyItem[],
  platform: PlatformId,
  field: string,
  transform?: string,
): boolean {
  for (const item of items) {
    const src = item.source;
    if (!Array.isArray(src)) continue;
    for (const entry of src) {
      if (typeof entry !== "object" || entry === null) continue;
      const m = entry as PlatformMapping;
      if (
        m.platform === platform &&
        m.kind === "structured_field" &&
        m.field === field &&
        (transform === undefined || m.transform === transform)
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasFreeText(
  items: TaxonomyItem[],
  platform: PlatformId,
  field: string,
): boolean {
  for (const item of items) {
    const src = item.source;
    if (!Array.isArray(src)) continue;
    for (const entry of src) {
      if (typeof entry !== "object" || entry === null) continue;
      const m = entry as PlatformMapping;
      if (
        m.platform === platform &&
        m.kind === "free_text" &&
        m.field === field
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasRoomCounter(
  items: TaxonomyItem[],
  platform: PlatformId,
  counter: string,
): boolean {
  for (const item of items) {
    const src = item.source;
    if (!Array.isArray(src)) continue;
    for (const entry of src) {
      if (typeof entry !== "object" || entry === null) continue;
      const m = entry as PlatformMapping;
      if (
        m.platform === platform &&
        m.kind === "room_counter" &&
        m.counter === counter
      ) {
        return true;
      }
    }
  }
  return false;
}

type CatalogEntry = {
  id: string;
  label_en?: string;
  relevance: string;
  reason?: string;
  collapsed_to?: string;
  notes?: string;
};

type ManifestEntry = {
  kind: "structured_field" | "free_text" | "room_counter";
  field?: string;
  counter?: string;
  transform?: string;
  target_taxonomy: MappableTaxonomy;
  semantics?: string;
  relevance: string;
  reason?: string;
};

type CatalogDoc = {
  pinned_at: string;
  source_urls: string[];
  scope: string;
  notes?: string;
  entries: CatalogEntry[];
};

type ManifestDoc = {
  pinned_at: string;
  source_urls: string[];
  scope: string;
  notes?: string;
  entries: ManifestEntry[];
};

// ── Schema invariants (apply to every catalog and manifest) ──

type CatalogFixture = {
  name: string;
  doc: CatalogDoc;
  platform: PlatformId;
  target_taxonomy: MappableTaxonomy;
};

type ManifestFixture = {
  name: string;
  doc: ManifestDoc;
  platform: PlatformId;
};

const CATALOGS: CatalogFixture[] = [
  {
    name: "airbnb-amenities",
    doc: airbnbAmenities as CatalogDoc,
    platform: "airbnb",
    target_taxonomy: "amenities",
  },
  {
    name: "booking-amenities",
    doc: bookingAmenities as CatalogDoc,
    platform: "booking",
    target_taxonomy: "amenities",
  },
  {
    name: "airbnb-property-types",
    doc: airbnbPropertyTypes as CatalogDoc,
    platform: "airbnb",
    target_taxonomy: "property_types",
  },
  {
    name: "booking-property-types",
    doc: bookingPropertyTypes as CatalogDoc,
    platform: "booking",
    target_taxonomy: "property_types",
  },
  {
    name: "airbnb-access-methods",
    doc: airbnbAccessMethods as CatalogDoc,
    platform: "airbnb",
    target_taxonomy: "access_methods",
  },
];

const MANIFESTS: ManifestFixture[] = [
  {
    name: "airbnb-structured-fields",
    doc: airbnbStructuredFields as ManifestDoc,
    platform: "airbnb",
  },
  {
    name: "booking-structured-fields",
    doc: bookingStructuredFields as ManifestDoc,
    platform: "booking",
  },
];

describe("Platform reverse coverage — schema invariants", () => {
  for (const { name, doc } of CATALOGS) {
    describe(`catalog ${name}`, () => {
      it("has pinned_at, source_urls[], scope, entries[]", () => {
        expect(doc.pinned_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Array.isArray(doc.source_urls)).toBe(true);
        expect(doc.source_urls.length).toBeGreaterThan(0);
        expect(typeof doc.scope).toBe("string");
        expect(Array.isArray(doc.entries)).toBe(true);
        expect(doc.entries.length).toBeGreaterThan(0);
      });

      it("no entry uses relevance:'deferred'", () => {
        const deferred = doc.entries.filter((e) => e.relevance === "deferred");
        expect(
          deferred.map((e) => e.id),
          `deferred entries remain in ${name}`,
        ).toEqual([]);
      });

      it("every entry has relevance in {covered, out_of_scope}", () => {
        const bad = doc.entries.filter(
          (e) => !ALLOWED_RELEVANCE.has(e.relevance),
        );
        expect(
          bad.map((e) => `${e.id}=${e.relevance}`),
          `bad relevance in ${name}`,
        ).toEqual([]);
      });

      it("every out_of_scope entry has a normalized reason", () => {
        const badReason: string[] = [];
        for (const entry of doc.entries) {
          if (entry.relevance !== "out_of_scope") continue;
          if (!entry.reason || !NORMALIZED_REASONS.has(entry.reason)) {
            badReason.push(`${entry.id}=${entry.reason ?? "(missing)"}`);
          }
        }
        expect(badReason, `bad/missing reasons in ${name}`).toEqual([]);
      });
    });
  }

  for (const { name, doc } of MANIFESTS) {
    describe(`manifest ${name}`, () => {
      it("has pinned_at, source_urls[], scope, entries[]", () => {
        expect(doc.pinned_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Array.isArray(doc.source_urls)).toBe(true);
        expect(doc.source_urls.length).toBeGreaterThan(0);
        expect(typeof doc.scope).toBe("string");
        expect(Array.isArray(doc.entries)).toBe(true);
        expect(doc.entries.length).toBeGreaterThan(0);
      });

      it("no entry uses relevance:'deferred'", () => {
        const deferred = doc.entries.filter((e) => e.relevance === "deferred");
        expect(deferred.length, `deferred entries in ${name}`).toBe(0);
      });

      it("every out_of_scope entry has a normalized reason", () => {
        const bad: string[] = [];
        for (const entry of doc.entries) {
          if (entry.relevance !== "out_of_scope") continue;
          if (!entry.reason || !NORMALIZED_REASONS.has(entry.reason)) {
            bad.push(`${entry.kind}:${entry.field ?? entry.counter}=${entry.reason ?? "(missing)"}`);
          }
        }
        expect(bad, `bad/missing reasons in ${name}`).toEqual([]);
      });

      it("every entry declares target_taxonomy", () => {
        const missing = doc.entries.filter(
          (e) => !(e.target_taxonomy in CLASSIFIABLE),
        );
        expect(
          missing.map((e) => `${e.kind}:${e.field ?? e.counter}=${e.target_taxonomy}`),
          `bad target_taxonomy in ${name}`,
        ).toEqual([]);
      });

      it("every structured_field entry has a transform", () => {
        const bad: string[] = [];
        for (const entry of doc.entries) {
          if (entry.kind !== "structured_field") continue;
          if (!entry.transform) bad.push(`${entry.field}=(missing transform)`);
        }
        expect(bad, `missing transforms in ${name}`).toEqual([]);
      });
    });
  }
});

// ── Reverse coverage: every covered catalog entry must be referenced ──

describe("Platform reverse coverage — catalogs", () => {
  for (const { name, doc, platform, target_taxonomy } of CATALOGS) {
    describe(`${name} → ${target_taxonomy}`, () => {
      const items = CLASSIFIABLE[target_taxonomy];

      it("every covered entry is referenced by at least one taxonomy item", () => {
        const gaps: string[] = [];
        for (const entry of doc.entries) {
          if (entry.relevance !== "covered") continue;
          if (!hasExternalId(items, platform, entry.id)) {
            gaps.push(entry.id);
          }
        }
        expect(
          gaps,
          `covered entries in ${name} with no taxonomy reference`,
        ).toEqual([]);
      });

      it("every collapsed_to target exists and carries the external_id", () => {
        const bad: Array<{ id: string; collapsed_to: string; error: string }> = [];
        for (const entry of doc.entries) {
          if (!entry.collapsed_to) continue;
          const target = findItemById(target_taxonomy, entry.collapsed_to);
          if (!target) {
            bad.push({
              id: entry.id,
              collapsed_to: entry.collapsed_to,
              error: `unknown item id`,
            });
            continue;
          }
          if (!hasExternalId([target], platform, entry.id)) {
            bad.push({
              id: entry.id,
              collapsed_to: entry.collapsed_to,
              error: `target item does not carry external_id`,
            });
          }
        }
        expect(bad, `bad collapsed_to in ${name}`).toEqual([]);
      });
    });
  }
});

// ── Reverse coverage: every covered manifest entry must be referenced ──

describe("Platform reverse coverage — manifests", () => {
  for (const { name, doc, platform } of MANIFESTS) {
    describe(`${name}`, () => {
      it("every covered entry is referenced by at least one taxonomy item", () => {
        const gaps: string[] = [];
        for (const entry of doc.entries) {
          if (entry.relevance !== "covered") continue;
          const items = CLASSIFIABLE[entry.target_taxonomy];
          let ok = false;
          if (entry.kind === "structured_field" && entry.field) {
            ok = hasStructuredField(items, platform, entry.field, entry.transform);
          } else if (entry.kind === "free_text" && entry.field) {
            ok = hasFreeText(items, platform, entry.field);
          } else if (entry.kind === "room_counter" && entry.counter) {
            ok = hasRoomCounter(items, platform, entry.counter);
          }
          if (!ok) {
            gaps.push(
              `${entry.kind}:${entry.field ?? entry.counter} → ${entry.target_taxonomy}`,
            );
          }
        }
        expect(
          gaps,
          `covered manifest entries in ${name} with no taxonomy reference`,
        ).toEqual([]);
      });
    });
  }
});
