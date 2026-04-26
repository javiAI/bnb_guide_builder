# PLATFORM_INTEGRATIONS

Outbound serializers that map our internal property model to third-party listing
platforms (Airbnb today, Booking.com later).

## 1. Status

- **Airbnb export (rama 14B)**: implemented as `GET /api/properties/[propertyId]/export/airbnb`. Returns `{ payload, warnings, generatedAt, taxonomyVersion }`.
- **Booking.com export (rama 14C)**: implemented as `GET /api/properties/[propertyId]/export/booking`. Same envelope as Airbnb; payload shape diverges (see §2 below).
- **Schema status — best-effort, not officially confirmed**: both `airbnbListingPayloadSchema` and `bookingListingPayloadSchema` are internal Zod representations derived from public developer docs (`developer.airbnb.com/docs/listings/api-reference` and Booking Connectivity API docs respectively). They are **not** contractually validated against either platform's API. Field shapes, enum vocabularies, and required-vs-optional flags may diverge from the real contracts. Treat the output as a structured draft, not a wire-ready POST body.

## 2. Architecture

Both exporters share a thin context loader and warning vocabulary in
`src/lib/exports/shared/`. The per-platform engine + reducers + schema remain
separate — Booking has enough semantic divergence from Airbnb (no structured
`check_in_method` enum, commercial_photography folds into free-text, no
`accessibility_features` namespace, renamed top-level fields) that a shared
engine would be a forced abstraction.

```
Property (DB)
  ↓ loadPropertyContext (shared/, Prisma, visibility:guest only)
PropertyExportContext  ← pure shape, no internal/sensitive surface
  ↓ build{Airbnb|Booking}Payload
  │   ├─ resolvePropertyTypeCanonical (isolated, per platform)
  │   ├─ [Airbnb only] getAirbnbId("access_methods", …)  (direct external_id)
  │   ├─ manifest walk (data-driven dispatch)
  │   │   ├─ structured_field {bool|enum|number|currency}
  │   │   ├─ room_counter
  │   │   └─ free_text  (Booking: house_rules_text + checkin_instructions;
  │   │                  Airbnb: house_rules only)
  │   └─ reduceAmenityExternalIds  (flat amenity_ids[])
  ↓
{ payload (Zod-validated), warnings[] }
```

### Key files

**Shared:**

- `src/lib/exports/shared/load-property.ts` — `PropertyExportContext` + Prisma loader (visibility:guest scoping)
- `src/lib/exports/shared/types.ts` — `ExportWarning`, `ExportWarningCode`, `PropertyNotFoundError`

**Airbnb (rama 14B):**

- `src/lib/exports/airbnb/serialize.ts` — orchestrator
- `src/lib/exports/airbnb/engine.ts` — manifest index, reducers, dispatcher
- `src/lib/exports/airbnb/manifest.ts` — Zod-parsed manifest loader
- `src/lib/schemas/airbnb-listing.ts` — Zod schema (best-effort)
- `src/app/api/properties/[propertyId]/export/airbnb/route.ts` — HTTP entrypoint

**Booking (rama 14C):**

- `src/lib/exports/booking/serialize.ts` — orchestrator
- `src/lib/exports/booking/engine.ts` — manifest index, reducers, dispatcher
- `src/lib/exports/booking/manifest.ts` — Zod-parsed manifest loader
- `src/lib/schemas/booking-listing.ts` — Zod schema (best-effort)
- `src/app/api/properties/[propertyId]/export/booking/route.ts` — HTTP entrypoint

**Shared resolver (used by both):**

- `src/lib/exports/shared/property-type-canonical.ts` — platform-parameterized first-mapping-canonical rule. Each platform barrel (`airbnb.ts`, `booking.ts`) exposes a 1-arg wrapper bound to its platform.

### 2.1 Booking payload shape — divergences from Airbnb

The Booking Zod schema intentionally differs from Airbnb's where the upstream
platform contracts differ:

| Field | Airbnb | Booking |
|---|---|---|
| Occupancy | `person_capacity` | `max_occupancy` |
| Policy bag | `listing_policies.*` | `policies.*` |
| Pricing bag | `pricing.{cleaning_fee, extra_person_fee}` | `fees.{cleaning, extra_person}` |
| House rules | `house_rules` | `house_rules_text` |
| Check-in | `check_in_method` (enum, external_id) | `checkin_instructions` (free-text) |
| Accessibility | `accessibility_features.*` bools | — (no namespace in Booking manifest) |
| Commercial photography | `listing_policies.commercial_photography_allowed` bool | folded into `house_rules_text` free-text only when `with_permission` |

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

Two test gates close the loop between our taxonomies and each platform manifest:

- **Reverse coverage (rama 14A, `platform-reverse-coverage.test.ts`)** — every
  taxonomy item with a `source[platform="airbnb"|"booking"]` mapping points at
  a real manifest entry. Catches typos / removed platform fields.
- **Forward coverage — per platform.**
  - `airbnb-export-manifest-coverage.test.ts` (rama 14B)
  - `booking-export-manifest-coverage.test.ts` (rama 14C)

  Each asserts that every manifest entry with `relevance: "covered"` has at
  least one taxonomy item targeting it. Catches silent omissions (manifest
  declares a field we never populate).

Together: no covered platform concept lacks an internal item, and no internal
mapping points at a phantom field.

## 5. Conventions

### 5.1 Property type — first-mapping-canonical rule

Internal `pt.*` items can collapse multiple platform categories on either side
(e.g. `pt.house → ["house", "townhouse", "cottage", …]` for Airbnb, or a set
of Booking PCT codes like `["7", "8", "27", …]`). Each export picks the
**first** external_id for its platform in the JSON `source[]` order as
canonical and emits a `no_mapping` warning listing the alternatives.

Centralized in shared `resolvePropertyTypeCanonical(id, platform)` at
`src/lib/exports/shared/property-type-canonical.ts`, with 1-arg per-platform
wrappers exposed via the platform barrels (`airbnb.ts`, `booking.ts`). Pinned
by `airbnb-export-property-type-canonical.test.ts` and
`booking-export-property-type-canonical.test.ts` so the rule can evolve
(e.g. host-side picker for the canonical alias) without touching the engines.

### 5.2 Pricing fields — always omitted with warning (v1)

Airbnb `pricing.{cleaning_fee, extra_person_fee}` and Booking
`fees.{cleaning, extra_person}` are declared `covered` in their manifests but
always emit `missing_pricing_currency` warnings and are never populated.
Reason: `policiesJson.supplements.{cleaning,extraGuest}.amount` exists, but no
`currency` field is available on Property in the current schema. Lifting this
requires a property-level `currency` decision (out of 14B/14C scope).

### 5.3 Smoking enum — passthrough with warning

Our smoking vocabulary (`not_allowed | outdoors_only | designated_area | no_restriction`)
does not map cleanly to either platform's option set. Both exporters pass the
value through and emit `enum_value_passthrough` so the host knows manual
adjustment may be needed.

### 5.4 House rules — free text aggregation

Composed in Spanish from `policiesJson` (quiet hours, smoking, events, pets,
services). One `free_text_passthrough` warning is emitted unconditionally to
flag that the host may want to localize / edit.

- **Airbnb** — emits the aggregated text as `house_rules`.
  Commercial-photography goes into the structured bool
  `listing_policies.commercial_photography_allowed` (not into the free-text).
- **Booking** — emits as `house_rules_text`. Booking has no structured
  commercial_photography bool, so `with_permission` folds into the free-text
  as an extra line; `not_allowed` adds nothing (redundant with default).

### 5.5 Check-in instructions (Booking-only free-text)

Booking has no structured `check_in_method` enum. The `checkin_instructions`
free-text field is composed from `primaryAccessMethod` (taxonomy label) and
`customAccessMethodLabel` as `Método de acceso: {label} — {custom}.`. Emits a
`free_text_passthrough` warning. Airbnb keeps its structured
`check_in_method` external_id (direct `getAirbnbId` lookup, bypassing the
manifest).

### 5.6 No-leak invariant

`loadPropertyContext` (shared) filters Prisma reads by `visibility: "guest"`
for `spaces` and `amenityInstances`. The `PropertyExportContext` type itself
does not carry visibility-tagged fields, so the leak surface is zero by
construction. Both `airbnbListingPayloadSchema` and `bookingListingPayloadSchema`
are `.strict()`, rejecting unknown keys at validation time. Pinned by
`airbnb-export-no-leak.test.ts` and `booking-export-no-leak.test.ts`.

## 6. Warning codes

Shared vocabulary (`ExportWarningCode` in `src/lib/exports/shared/types.ts`):

| Code | When |
|---|---|
| `no_mapping` | Taxonomy id has no mapping for the target platform, or property type has multiple platform aliases |
| `platform_not_supported` | Taxonomy item has `platform_supported: false` |
| `custom_value_unmapped` | Host supplied a custom label (e.g. property type, access method) and we omitted the field |
| `missing_pricing_currency` | Pricing field always omitted in v1 (no `currency` on Property) |
| `enum_value_passthrough` | Enum value (e.g. smoking) emitted as-is; vocabulary may not match the platform |
| `free_text_passthrough` | Free-text field (e.g. house_rules / house_rules_text / checkin_instructions) emitted; host may want to edit |
| `schema_validation_failed` | Zod validation failed; payload returned as defensive empty fallback |

## 7. Testing

**Airbnb (rama 14B):**

- `src/test/airbnb-export-property-type-canonical.test.ts` — pins the first-mapping-canonical rule.
- `src/test/airbnb-export-manifest-coverage.test.ts` — forward coverage gate.
- `src/test/airbnb-export.test.ts` — `buildAirbnbPayload` happy path, partial context, custom values, room-counter fallback, events policy boolean.
- `src/test/airbnb-export-no-leak.test.ts` — Prisma scoping, schema strictness, output sentinel-substring scan.

**Booking (rama 14C):**

- `src/test/booking-export-property-type-canonical.test.ts` — pins the first-mapping-canonical rule for Booking PCT codes.
- `src/test/booking-export-manifest-coverage.test.ts` — forward coverage gate for the Booking manifest.
- `src/test/booking-export.test.ts` — `buildBookingPayload` happy path, partial context, custom values, room-counter fallback, events policy boolean, commercial_photography asymmetry, checkin_instructions.
- `src/test/booking-export-no-leak.test.ts` — Prisma scoping, schema strictness, output sentinel-substring scan.

## 8. Import — Airbnb preview (rama 14D)

Preview-only inbound reconciliation. No mutations. Rama 14D accepts an Airbnb
listing JSON, parses it, loads the current Property state, and returns a
structured diff showing conflicts, unactionable fields, and fallback suggestions.
The reconciler itself is provider-agnostic; Airbnb-specific details stay in the
parser + catalogs.

**Status**: Airbnb preview ✅ (Rama 14D merged). Booking preview (Rama 14E, PR #85 in review).

**Flow**:

```
Airbnb JSON (via UI textarea)
  ↓ POST /api/properties/[propertyId]/import/airbnb/preview
  ├─ Zod validation (strict)
  ├─ airbnbToCanonical (Airbnb-specific parser, catalog lookups)
  ├─ loadPropertyContext (current state, visibility:guest scoping)
  └─ computeImportDiff (provider-agnostic reconciler)
    ↓
{ diff: { scalar, policies, presence, amenities, freeText, customs }, warnings[] }
```

**Key files:**

- `src/lib/imports/shared/types.ts` — canonical `PropertyImportContext`, `ImportDiff`, `UnactionableReason`, `ImportWarning`
- `src/lib/imports/shared/diff-engine.ts` — `computeImportDiff` (6 reconciliation categories)
- `src/lib/imports/airbnb/catalogs.ts` — reverse index (external_id → taxonomy_id) from 14A platform catalogs
- `src/lib/imports/airbnb/parser.ts` — `airbnbToCanonical` (Zod → canonical context)
- `src/lib/imports/airbnb/serialize.ts` — `previewAirbnbImport` (orchestrator)
- `src/lib/schemas/airbnb-listing-input.ts` — Zod input schema (strict, superset of export)
- `src/app/api/properties/[propertyId]/import/airbnb/preview/route.ts` — HTTP entrypoint
- `src/app/properties/[propertyId]/settings/airbnb-import-preview.tsx` — UI (textarea + diff table)

### 8.1 Reconciliation categories

**scalar** — `propertyType`, `primaryAccessMethod`, `bedroomsCount`, `bathroomsCount`, `personCapacity`. Standard 3-state: fresh (incoming value, current null), identical, conflict (both set, different). Suggested action always reflects DB-first philosophy: `take_import` only for fresh, `keep_db` otherwise.

**policies** — Sub-keys of `policiesJson`. Same 3-state logic except:

- `events.policy` triggers `lossy_projection` when DB has granularity > binary (e.g. "allowed_quiet" vs incoming "allowed"). Binary-to-binary is normal 3-state.

**presence** — Booleans for shared_spaces, amenity shells, accessibility features. Always unactionable with reason `presence_signal_only` (inbound signal cannot reconstruct entity identity).

**amenities** — Set diff (add/remove/identical) on taxonomy IDs. No state; taxonomy labels are read from the taxonomy itself, not the diff.

**freeText** — diff-only category (no status). Current always null (no pre-rendered house_rules in DB). Shown side-by-side for host inspection only.

**customs** — Fallback suggestions for external_ids that did not resolve to any taxonomy item. Never auto-resolved. Reason: `no_matching_taxonomy_item`.

### 8.2 Unactionable reasons

| Reason | When |
| --- | --- |
| `presence_signal_only` | Inbound presence bool cannot create/delete Spaces or amenity shells |
| `lossy_projection` | Incoming mapping degrades DB granularity (e.g. Airbnb binary → DB "allowed_quiet") |
| `requires_currency_decision` | Pricing value arrived but Property has no `currency` field |
| `requires_entity_identity` | (reserved for future; not emitted by 14D) |

### 8.3 Warnings

Shared `ImportWarningCode`:

| Code | When |
| --- | --- |
| `unresolved_external_id` | external_id in payload does not match any taxonomy or catalog entry |
| `platform_not_supported` | external_id matched a catalog entry marked `relevance: "out_of_scope"` |
| `payload_parse_error` | Zod validation failed; invalid JSON structure or type mismatch |
| `locale_mismatch` | Payload locale differs from property `defaultLocale` (impacts house_rules interpretation) |
| `free_text_not_reconciled` | Reminder: house_rules cannot be reconciled field-by-field; diff-only |
| `requires_currency_for_fees` | Pricing fields arrived without `currency` — see unactionable category |
| `enum_value_passthrough` | Smoking or other enum passed through verbatim (vocabulary mismatch risk) |

### 8.4 No-mutate invariant

Rama 14D is preview-only. The entire `src/lib/imports/` tree and the endpoint
make zero calls to `prisma.*.{create,update,delete,upsert,execute*}`. The route
handler returns a diff + warnings; apply is out of scope. Pinned by
`src/test/import-preview-no-mutate.test.ts`.

## 8.5 Auth / access control

See §10 below — same status quo as exports: knowledge of `propertyId` is the only gate until Fase 16.

## 9. Import — Booking preview (rama 14E)

Symmetric to §8 (Airbnb), preview-only inbound reconciliation for Booking.com payloads.
Reuses the shared `PropertyImportContext` type, `computeImportDiff` engine, and diff UI
component from 14D. Parser is Booking-specific; catalogs, reconciliation, warnings are
provider-agnostic.

**Divergences from Airbnb (14D) shape**:

- `max_occupancy` (int) → `personCapacity` (no `person_capacity` field in Booking)
- `fees.{cleaning, extra_person}` → matches Airbnb `pricing.*` semantically but different field names
- `policies.*` shape: `smoking` (string enum), `parties` (bool), `pets` (bool) — simpler than Airbnb's nested `listing_policies`
- `house_rules_text` (string) and `checkin_instructions` (string) — both free-text, no enum for check-in method
- No `accessibility_features.*` namespace (Booking manifest does not declare any; silent drop in parser)
- No `commercial_photography_allowed` (folded into house_rules during export; silent drop in parser)

**Key files**:

- `src/lib/imports/booking/catalogs.ts` — reverse index (Booking PCT codes + amenities → internal IDs)
- `src/lib/imports/booking/parser.ts` — `bookingToCanonical` (maps Booking-specific divergences)
- `src/lib/imports/booking/serialize.ts` — `previewBookingImport` (orchestrator)
- `src/lib/schemas/booking-listing-input.ts` — **superset curated**: accepts heterogeneous Booking payloads; validates only critical fields
- `src/app/api/properties/[propertyId]/import/booking/preview/route.ts` — HTTP endpoint
- `src/app/properties/[propertyId]/settings/booking-import-preview.tsx` — UI (mirrors Airbnb component)

**Free-text handling (14E adjustment)**:

Unlike 14D which only has `freeText.houseRules`, Rama 14E adds `freeText.checkInInstructions` because Booking has no enum for check-in method. Both are diff-only (unreconcilable); host decides manually if they absorb the text. See `src/lib/imports/shared/diff-engine.ts` for the second free-text block.

**Parser schema strategy**:

`booking-listing-input.ts` uses `.passthrough()` at the top level instead of `.strict()`, allowing hosts to paste heterogeneous Booking payloads directly from the platform (not just our exports). Sub-objects (policies, shared_spaces, amenities, fees) remain `.strict()` to validate internal shape. Unknown top-level fields are silently ignored; parse errors only on malformed critical fields.

**No-mutate invariant**: Same as 14D — zero Prisma mutations. Pinned by `src/test/import-preview-no-mutate.test.ts`.

## 10. Deferred / out of scope

- Pricing fields (need property-level `currency` — both platforms).
- Direct POST to platform APIs (produces JSON drafts; transport is a separate concern).
- LLM-assisted vocabulary mapping for enum passthroughs (smoking on both platforms; Booking options catalogue overall).

## 11. Auth / access control status

**Endpoints hardened (Fase 15 closed)**. Source of truth: [docs/SECURITY_AND_AUDIT.md §0](../SECURITY_AND_AUDIT.md). Resumen aplicable a los endpoints de esta feature:

- `GET /api/properties/:propertyId/export/airbnb` y `GET /api/properties/:propertyId/export/booking` están envueltos en `withOperatorGuards({ rateLimit: "expensive" })` (10 req/60s per actor) — 15B aplicó la composición session + workspace ownership.
- `POST /api/properties/:propertyId/import/airbnb/preview` y `POST /api/properties/:propertyId/import/booking/preview` (14D/14E) — `withOperatorGuards({ rateLimit: "mutate" })`.
- `POST /api/properties/:propertyId/import/airbnb/apply` y `POST /api/properties/:propertyId/import/booking/apply` (15E) — `withOperatorGuards({ rateLimit: "mutate" })` + `writeAudit({ action: "import.apply", actor: "user:<id>", diff })` con idempotency fingerprint. Ver §12.

Defense-in-depth a nivel de datos (siguen vigentes):

- `visibility: "guest"` filter en [`loadPropertyContext`](../../src/lib/exports/shared/load-property.ts) — internal/sensitive rows nunca entran al pipeline de export.
- `.strict()` Zod schemas `airbnbListingPayloadSchema` y `bookingListingPayloadSchema` — unknown keys no se serializan.
- Invariantes en `src/test/airbnb-export-no-leak.test.ts` y `src/test/booking-export-no-leak.test.ts`.

Para el contrato del wrapper, buckets de rate-limit, audit writer y reglas duras de nuevas rutas, ver `docs/SECURITY_AND_AUDIT.md` §0.1–§0.4. No describir endpoints de esta feature en términos de auth fuera de ese doc — el patrón canónico vive ahí.

## 12. Apply (rama 15E)

The apply endpoints close the import loop opened by 14D/14E preview: take a previewed payload + per-field user resolutions, recompute the diff server-side, and mutate the Property in a single transaction with a row lock + idempotent audit envelope.

**Endpoints**: `POST /api/properties/:propertyId/import/airbnb/apply` and `POST /api/properties/:propertyId/import/booking/apply`. Wrapped in `withOperatorGuards({ rateLimit: "mutate" })` so 15A–15D guards apply (session + workspace ownership + 20 req/60s per actor).

**Body shape**:

```json
{
  "payload": { /* same payload that the matching /preview accepted */ },
  "resolutions": {
    "scalar.bedroomsCount": "take_import",
    "policies.cancellation.policy": "keep_current",
    "amenities.add.am.wifi": "skip"
  }
}
```

**Strategies**: `take_import` (overwrite current with incoming), `keep_current` (no-op for that field), `skip` (no-op + recorded in `skipped[]`). No `overwrite` keyword — `take_import` covers it.

**Field naming**:

- `scalar.<field>` for scalars (`bedroomsCount`, `bathroomsCount`, `personCapacity`, …).
- `policies.<dot.path>` for policies (already prefixed by the diff entry).
- `amenities.add.<taxonomyId>` and `amenities.remove.<taxonomyId>` for amenity instances.
- `presence.*`, `freeText.*`, `customs.*` are **non-actionable** — passing a resolution that targets one of those prefixes returns `400 INVALID_RESOLUTION` with `reason: "non_actionable_category"`. The applier never mutates these categories; preview surfaces them for review only.

**Server-recomputed diff**: the applier never trusts the client's preview snapshot. It re-invokes `previewAirbnbImport` / `previewBookingImport` against the persisted Property, then reconciles `resolutions` against that fresh diff. A resolution that references a field absent from the recomputed diff returns `409 STALE_RESOLUTIONS` with `{ diff, missingFields[] }` so the UI can re-render the picker against the new diff.

**Server-forced skips**: policy entries with `status: "unactionable"` (e.g. `lossy_projection`, `requires_currency_decision`) are forcibly skipped server-side and surfaced in `skipped[]` + `warnings[]`. A client `take_import` resolution on those fields is silently ignored — the user cannot override.

**Transaction model**: a single `prisma.$transaction` opens with a row lock —

```ts
await tx.$executeRaw`SELECT id FROM properties WHERE id = ${propertyId} FOR UPDATE`;
```

— without that lock, two concurrent applies could read+merge stale `policiesJson` snapshots under default READ_COMMITTED isolation. Inside the tx: scalar `tx.property.update`, policies merged via read+setDeep+write, amenity shells via `propertyAmenityInstance.createMany({ skipDuplicates: true })` / `deleteMany`. The audit row is written **outside** the tx (fail-soft), so an audit DB hiccup never rolls back a successful mutation.

**Idempotency**: every input `(platform, payload, resolutions)` produces a stable 16-char fingerprint (SHA-256 over canonical JSON, sorted keys recursively). Before the tx, the applier looks for a prior `AuditLog` row with `action=import.apply` + matching fingerprint where `failed != true`. If found → returns `result: "noop"` without touching the Property and without writing a new audit row (logged via `console.info`). Failed rows do NOT block re-apply, so a transient DB error → retry → success scenario works as expected. Caveat: an audit failure that occurs *after* the tx commits leaves the mutation persisted with no audit trail; a re-apply would mutate again at the value level (idempotent) but would emit a duplicate audit row. Acceptable tradeoff per Fase -1 of 15E.

**Audit envelope**: `diff: { platform, payloadFingerprint, applied, skipped, warnings }` on success; `diff: { platform, payloadFingerprint, failed: true, error }` on failure. `entityType: "Property"`, `entityId: propertyId`, `action: "import.apply"`, `actor: "user:<id>"`. Diff redaction (`redactSecretsForAudit`) applies as for every other audit row.

**UI integration**: the Airbnb and Booking preview panels in `src/app/properties/[propertyId]/settings/` render `<ImportApplyPanel endpoint=... preview=... payload=... />` after a successful preview. The panel renders a 3-radio strategy picker per actionable field, POSTs `{payload, resolutions}` to the apply endpoint, and surfaces `success` / `noop` / `stale` / `invalid` / `failed` inline. No modal, no server action wrapper — direct `fetch()`.
