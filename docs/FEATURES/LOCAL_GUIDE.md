# Local Guide (Rama 13A — `feat/local-pois-autosuggest`)

La guía local del host se construye sobre `LocalPlace` con una capa de autosuggest provider-agnostic por encima. El flujo típico:

1. Host teclea ("restaurante") en el formulario.
2. `PlaceAutocomplete` hace typeahead contra `GET /api/properties/:propertyId/places-search`.
3. El backend resuelve un `LocalPoiProvider` (MapTiler en prod, mock en dev sin key) y devuelve `PoiSuggestion[]` mapeadas a categorías `lp.*`.
4. Host selecciona una; el form copia lat/lng/address/website + `provider`/`providerPlaceId` + `providerMetadata` reducida al `create` action.
5. `createLocalPlaceAction` persiste el `LocalPlace`. El `@@unique(propertyId, provider, providerPlaceId)` evita duplicados (catch P2002 → "Este lugar ya está añadido"). Rows manuales (provider NULL) nunca chocan gracias a la semántica NULLs-distinct de Postgres.

## Piezas

### Taxonomía

`taxonomies/local_place_categories.json` — 14 entries `lp.<slug>` (restaurant, cafe, bar, supermarket, pharmacy, hospital, transport, parking, attraction, beach, park, gym, laundry, other). Cargada por `loadLocalPlaceCategories()` en [src/lib/taxonomy-loader.ts](../../src/lib/taxonomy-loader.ts) con Zod fail-loud. Helpers: `findLocalPlaceCategory(id)`, `isLocalPlaceCategoryKey(id)`.

### Provider abstraction

[src/lib/services/places/provider.ts](../../src/lib/services/places/provider.ts) declara el contrato mínimo:

```ts
interface LocalPoiProvider {
  name: "maptiler" | "mock";
  search(params: SearchParams): Promise<PoiSuggestion[]>;
}
```

`PoiSuggestion` lleva `providerPlaceId` (fingerprint estable), `categoryKey` ∈ `lp.*` (validado por Zod refine contra `isLocalPlaceCategoryKey`), coords, address/website opcionales, `distanceMeters` (derivado server-side vía `haversineMeters`), y `providerMetadata` reducida (`nativeCategory`, `placeTypes[]`, `confidence`, `retrievedAt`).

Errores tipados: `PoiProviderConfigError` (factory fail-fast) → 503; `PoiProviderUnavailableError` (upstream down) → 502.

### Factory con fingerprint cache

[src/lib/services/places/index.ts](../../src/lib/services/places/index.ts) — `resolveLocalPoiProvider()` cachea por fingerprint `(NODE_ENV | LOCAL_POI_PROVIDER | key?)`. Sigue el patrón del assistant pipeline (`embeddings.service.ts`, `synthesizer.ts`). Prod + `LOCAL_POI_PROVIDER=maptiler` + `MAPTILER_API_KEY` missing → throw. Dev sin key → degrada a `MockPlacesProvider` con warn. Tests inyectan vía `__setLocalPoiProviderForTests` (pinea fingerprint `"__test__"`).

### MapTiler provider

[src/lib/services/places/maptiler-provider.ts](../../src/lib/services/places/maptiler-provider.ts) — hits `api.maptiler.com/geocoding/{query}.json?types=poi&proximity={lng,lat}&language=&limit=`. Mapeo de categorías en [maptiler-category-mapping.ts](../../src/lib/services/places/maptiler-category-mapping.ts) — array de regex con prioridad explícita (pharmacy antes que shop, supermarket antes que shop). Features sin coords válidas o sin categoría mapeable se descartan (`safeParse` defensivo), nunca propagan up al huésped.

### Rate limit

[src/lib/services/places/rate-limit.ts](../../src/lib/services/places/rate-limit.ts) — sliding window 30 req / 60 s / propertyId, en memoria (single Next process). Soft cap de 256 buckets con eviction LRU de stale keys. La comprobación corre **después** del property lookup en el route handler, así los 404/409 no drenan la quota. Retorna `Retry-After` header.

### Route

`GET /api/properties/:propertyId/places-search?q=<2-120>&limit=<1-15>&lang=es|en`

Anchor lat/lng derivados server-side de `Property.latitude`/`longitude` — **nunca** del query string. Respuestas:

| Status | Shape | Cuándo |
|---|---|---|
| 200 | `{ suggestions: PoiSuggestion[], provider }` | OK |
| 400 | `{ error: "invalid_query", issues }` | Zod fail |
| 404 | `{ error: "not_found" }` | property no existe |
| 409 | `{ error: "property_missing_coordinates" }` | property sin lat/lng |
| 429 | `{ error: "rate_limited", retryAfterSeconds }` | rate limit |
| 502 | `{ error: "provider_unavailable" }` | upstream down |
| 503 | `{ error: "provider_not_configured" }` | config fail-fast |

`Cache-Control: no-store` en todas.

### Cliente — `PlaceAutocomplete`

[src/components/local-guide/place-autocomplete.tsx](../../src/components/local-guide/place-autocomplete.tsx) — `useDeferredValue` + debounce 250 ms + `AbortController`. Combobox role con keyboard nav (Arrow/Enter/Escape). Cleanup en effect aborta cualquier request pendiente al desmontar o cambiar query. Muestra estados tipados (`loading`, `rate_limited`, `provider_unavailable`, `property_missing_coordinates`, `error`, `ok`) con fallback "Añadir manualmente" que abre el form completo.

### Data model

`LocalPlace` gana (rama 13A): `latitude`, `longitude` (DOUBLE PRECISION), `address`, `website`, `provider`, `providerPlaceId`, `providerMetadata` (JSONB). `@@unique([propertyId, provider, providerPlaceId], map: "local_places_property_provider_place_unique")` — NULLs-distinct => rows manuales coexisten sin colisión. Ver `docs/DATA_MODEL.md`.

### Env vars

```bash
LOCAL_POI_PROVIDER=maptiler   # default "maptiler"; "mock" fuerza el provider sintético
MAPTILER_API_KEY=...          # requerido en prod si provider=maptiler
```

## Cómo añadir un nuevo provider

1. Implementar `LocalPoiProvider` en `src/lib/services/places/<name>-provider.ts`. El mapeo de categorías nativas → `lp.*` vive en su propio archivo (`<name>-category-mapping.ts`) con patterns priorizados.
2. Extender `resolveLocalPoiProvider()` con el nuevo `envChoice` y actualizar el fingerprint si añade env vars nuevas.
3. Reutilizar `src/test/places-provider-contract.test.ts` pasando una factory del nuevo provider (contrato compartido).
4. Añadir tests específicos de parsing + mapeo + error paths (ver `places-maptiler-provider.test.ts` como plantilla).

## Referencias

- Schema: [src/lib/schemas/editor.schema.ts](../../src/lib/schemas/editor.schema.ts) — `createLocalPlaceSchema` con `superRefine` para paired-field invariants (lat↔lng, provider↔providerPlaceId, providerMetadata ⇒ provider).
- Action: `createLocalPlaceAction` en [src/lib/actions/editor.actions.ts](../../src/lib/actions/editor.actions.ts).
- UI: [src/app/properties/[propertyId]/local-guide/](../../src/app/properties/[propertyId]/local-guide/).
