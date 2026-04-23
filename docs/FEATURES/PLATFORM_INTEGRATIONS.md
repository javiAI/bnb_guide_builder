# PLATFORM_INTEGRATIONS

Outbound serializers that map our internal property model to third-party listing
platforms (Airbnb today, Booking.com later).

## 1. Status

- **Airbnb export (rama 14B)**: implemented as `GET /api/properties/[propertyId]/export/airbnb`. Returns `{ payload, warnings, generatedAt, taxonomyVersion }`.
- **Schema status — best-effort, not officially confirmed**: `airbnbListingPayloadSchema` is an internal Zod representation we wrote against the public Airbnb developer docs (`developer.airbnb.com/docs/listings/api-reference`). It is **not** a contractually validated representation of the Listings API payload. Field shapes, enum vocabularies, and required-vs-optional flags may diverge from Airbnb's actual contract. Treat the output as a structured draft, not a wire-ready POST body.
- **Booking.com export**: not implemented. Manifest + helpers exist in `taxonomies/platform-catalogs/booking-*.json` (delivered in 14A) but no serializer yet.

## 2. Architecture

```
Property (DB)
  ↓ loadPropertyContext (Prisma, visibility:guest only)
PropertyExportContext  ← pure shape, no internal/sensitive surface
  ↓ buildAirbnbPayload
  │   ├─ resolvePropertyTypeCanonical (isolated)
  │   ├─ getAirbnbId("access_methods", …)  (direct external_id lookup)
  │   ├─ manifest walk (data-driven dispatch)
  │   │   ├─ structured_field {bool|enum|number|currency}
  │   │   ├─ room_counter
  │   │   └─ free_text
  │   └─ reduceAmenityExternalIds  (flat amenity_ids[])
  ↓
{ payload (Zod-validated), warnings[] }
```

### Key files

- `src/lib/exports/airbnb/serialize.ts` — orchestrator + Prisma loader
- `src/lib/exports/airbnb/engine.ts` — manifest index, reducers, dispatcher
- `src/lib/exports/airbnb/manifest.ts` — Zod-parsed manifest loader
- `src/lib/exports/airbnb/property-type-canonical.ts` — isolated property-type rule
- `src/lib/schemas/airbnb-listing.ts` — Zod schema (best-effort)
- `src/lib/exports/airbnb/types.ts` — `AirbnbExportResult`, `ExportWarning`, `ExportWarningCode`
- `src/app/api/properties/[propertyId]/export/airbnb/route.ts` — HTTP entrypoint

## 3. Data sources

Five taxonomies feed the export via their `source[]` platform mappings:

- `taxonomies/amenity_taxonomy.json` (incl. `ax.*` accessibility items)
- `taxonomies/property_types.json`
- `taxonomies/space_types.json`
- `taxonomies/access_methods.json`
- `taxonomies/policy_taxonomy.json` (used implicitly via `policiesJson` reducers)

Pinned platform manifests live in `taxonomies/platform-catalogs/`. The Airbnb
structured-fields manifest enumerates every field we serialize; the Zod-validated
loader rejects any drift on boot.

## 4. Coverage rules (forward + reverse)

Two test gates close the loop between our taxonomies and the manifest:

- **Reverse coverage (rama 14A, `platform-reverse-coverage.test.ts`)** — every
  taxonomy item with a `source[platform="airbnb"]` mapping points at a real
  manifest entry. Catches typos / removed Airbnb fields.
- **Forward coverage (rama 14B, `airbnb-export-manifest-coverage.test.ts`)** —
  every manifest entry with `relevance: "covered"` has at least one taxonomy
  item targeting it. Catches silent omissions (manifest declares a field we
  never populate).

Together: no covered Airbnb concept lacks an internal item, and no internal
mapping points at a phantom field.

## 5. Conventions

### 5.1 Property type — first-mapping-canonical rule

Internal `pt.*` items can collapse multiple Airbnb categories (e.g.
`pt.house → ["house", "townhouse", "cottage", …]`). The export picks the
**first** Airbnb `external_id` in the JSON `source[]` order as canonical and
emits a `no_mapping` warning listing the alternatives.

This rule is isolated in `resolvePropertyTypeCanonical()` and pinned by
`airbnb-export-property-type-canonical.test.ts` so it can be evolved
independently (e.g. host-side picker for the canonical alias) without
touching the engine.

### 5.2 Pricing fields — always omitted with warning (v1)

`pricing.cleaning_fee` and `pricing.extra_person_fee` are declared `covered` in
the manifest but always emit `missing_pricing_currency` warnings and are never
populated. Reason: `policiesJson.supplements.{cleaning,extraGuest}.amount`
exists, but no `currency` field is available on Property in the current schema.
Lifting this requires a property-level `currency` decision (out of 14B scope).

### 5.3 Smoking enum — passthrough with warning

Our smoking vocabulary (`not_allowed | outdoors_only | designated_area | no_restriction`)
does not map cleanly to Airbnb's. The reducer passes the value through and
emits `enum_value_passthrough` so the host knows manual adjustment may be needed.

### 5.4 House rules — free text aggregation

`house_rules` is composed in Spanish from `policiesJson` (quiet hours, smoking,
events, pets, services). One `free_text_passthrough` warning is emitted
unconditionally to flag that the host may want to localize / edit.
Commercial-photography policy is emitted separately as the structured field
`listing_policies.commercial_photography_allowed`, not inside `house_rules`.

### 5.5 No-leak invariant

`loadPropertyContext` filters Prisma reads by `visibility: "guest"` for
`spaces` and `amenityInstances`. The `PropertyExportContext` type itself does
not carry visibility-tagged fields, so the leak surface is zero by construction.
`airbnbListingPayloadSchema.strict()` rejects unknown keys at validation time.
Pinned by `airbnb-export-no-leak.test.ts`.

## 6. Warning codes

| Code | When |
|---|---|
| `no_mapping` | Taxonomy id has no Airbnb mapping, or property type has multiple Airbnb aliases |
| `platform_not_supported` | Taxonomy item has `platform_supported: false` |
| `custom_value_unmapped` | Host supplied a custom label (e.g. property type, access method) and we omitted the field |
| `missing_pricing_currency` | Pricing field always omitted in v1 (no `currency` on Property) |
| `enum_value_passthrough` | Enum value (e.g. smoking) emitted as-is; vocabulary may not match Airbnb |
| `free_text_passthrough` | Free-text field (e.g. house_rules) emitted; host may want to edit |
| `schema_validation_failed` | Zod validation failed; payload returned as defensive empty fallback |

## 7. Testing

- `src/test/airbnb-export-property-type-canonical.test.ts` — pins the first-mapping-canonical rule.
- `src/test/airbnb-export-manifest-coverage.test.ts` — forward coverage gate.
- `src/test/airbnb-export.test.ts` — `buildAirbnbPayload` happy path, partial context, custom values, room-counter fallback, events policy boolean.
- `src/test/airbnb-export-no-leak.test.ts` — Prisma scoping, schema strictness, output sentinel-substring scan.

## 8. Deferred / out of scope

- Booking.com serializer (manifest + helpers exist; no engine yet).
- Pricing fields (need property-level `currency`).
- Round-trip / inbound import (this branch is export-only).
- Direct POST to Airbnb API (this branch produces a JSON draft; transport is a separate concern).
- LLM-assisted vocabulary mapping for enum passthroughs.

## 9. Auth / access control status

**This endpoint is not hardened.** `GET /api/properties/:propertyId/export/airbnb` follows the same access-control pattern as every other route under `/api/properties/[propertyId]/...` in this repo: `prisma.property.findUnique → 404 if missing`. There is no session check, no workspace-membership check, no identity of the actor.

This is **not** an oversight specific to the export route — it reflects the current state of the entire codebase. No auth library is installed, no middleware resolves sessions, and the `Workspace` / `WorkspaceMembership` / `User` Prisma models are unused by any route handler or Server Action. A reviewer on PR #82 (Rama 14B) asked for "the same auth/ownership pattern used in other `/api/properties/[propertyId]/...` routes" — that pattern does not exist.

This endpoint **must not be treated as protected** by anyone reading its output. Consumers should assume that anyone who knows a `propertyId` can call it. Sensitive surfacing is already mitigated at the **data layer** by:

- The `visibility: "guest"` Prisma filter in [`loadPropertyContext`](../../src/lib/exports/airbnb/serialize.ts) — internal and sensitive rows never enter the export pipeline.
- The `.strict()` Zod schema on `airbnbListingPayloadSchema` — unknown keys cannot be serialized even if a reducer tried.
- The substring/schema invariants in `src/test/airbnb-export-no-leak.test.ts`.

These are defense-in-depth against data leaks, not authorization. Restricting who can **call** the endpoint is the job of the transversal **Fase 16 — Auth & access control foundation** (see `docs/MASTER_PLAN_V2.md`). Rama 16B applies guards to every operator-facing route, including this one.

Until Fase 16 lands, any feature or doc that references this export route must not describe it as "secured", "protected", or "operator-only" — it's gated only by knowledge of the `propertyId`, same as every other route under `/api/properties/[propertyId]/...`.
