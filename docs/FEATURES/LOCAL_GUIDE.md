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
  readonly name: string; // impls actuales: "maptiler" | "mock"
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

---

## Local events sync (Rama 13B — `feat/local-events-sync`)

Sync diario multi-source de eventos locales, ortogonal a `LocalPlace` (POIs estables). Backend-only en 13B: no hay UI huésped ni edición desde host (el sync es autoritativo por ahora). Pipeline encadenado sobre propiedades geo-ancladas:

```text
runLocalEventsTick (scheduler)
  └─ foreach Property (lat/lng not null)
       ├─ aggregateLocalEvents(providers[], {anchor, city, locale, window})
       │    └─ Promise.allSettled(providers.fetch) → canonicalize → merge
       └─ syncLocalEventsForProperty({aggregated, tickStartedAt})  [transaction]
             ├─ upsert LocalEvent por (propertyId, canonicalKey)
             ├─ upsert LocalEventSourceLink por (propertyId, source, sourceExternalId)
             ├─ deleteMany stale links (source dropped for an event)
             └─ deleteMany future rows no re-surfaced (retention sweep)
```

### Provider abstraction (events)

[src/lib/services/local-events/contracts.ts](../../src/lib/services/local-events/contracts.ts) declara la interfaz mínima:

```ts
interface LocalEventSourceProvider {
  readonly source: string;          // "predicthq" | "firecrawl" | "ticketmaster"
  readonly priority: number;         // 100 | 80 | 60 (per-family constant)
  fetch(params: SourceFetchParams): Promise<SourceFetchResult>;
}
```

**Envelope pattern** (`SourceFetchResult`): nunca throws al caller. Estados:

- `ok` — events válidos (puede ser array vacío)
- `disabled` — provider deshabilitado explícito (reservado, hoy ninguno lo emite)
- `config_error` — clave API missing o malformada; downgrades automáticos en dev
- `rate_limited` — 429 upstream
- `unavailable` — 5xx / network / timeout / body no parseable
- `parse_error` — shape inesperado

Cada envelope lleva `warnings[]`, `fetchedAt`, `durationMs` y opcional `error {kind, message}`. **Contrato duro**: un provider jamás devuelve events si `status !== "ok"`.

**Priority constants** (`PROVIDER_PRIORITY`):

- `predicthq: 100` — aggregator canónico (más confianza)
- `firecrawl: 80` — curated sources (depende de crawl hygiene)
- `ticketmaster: 60` — venue-authoritative pero menor cobertura

### Implementaciones

#### PredictHQ

[predicthq-provider.ts](../../src/lib/services/local-events/predicthq-provider.ts) — hits `api.predicthq.com/v1/events/` con `within={radius}km@{lat},{lng}` + `active.gte/lte` + `category=concerts,sports,performing-arts,festivals,community,expos,conferences`. Mapping nativo → `le.*` en tabla interna (longest-match). Sin `PREDICTHQ_API_KEY` emite `config_error` sin pegar a la red.

#### Firecrawl

[firecrawl-provider.ts](../../src/lib/services/local-events/firecrawl-provider.ts) — **scrape cache per-instance** (Map keyed por curatedUrl). El scheduler instancia el provider una vez por tick y reutiliza la instancia across propiedades, de modo que una misma URL curada se scrape a lo sumo una vez por tick. Curated URLs vienen de `taxonomies/local_event_sources.json` (scoped por city/region). El LLM extractor produce `{title, startsAt?, endsAt?, venue?, categoryHint?, imageUrl?, sourceUrl}`; se valida con Zod y se descartan items sin `title` o sin `startsAt` parseable.

#### Ticketmaster

[ticketmaster-provider.ts](../../src/lib/services/local-events/ticketmaster-provider.ts) — hits `app.ticketmaster.com/discovery/v2/events.json?latlong={lat},{lng}&radius=&unit=km&startDateTime=&endDateTime=`. TM devuelve URLs de venta directa con deep-link; por eso tiene **sourceUrl exception** en el merge (ver abajo).

### Aggregator

[aggregator.ts](../../src/lib/services/local-events/aggregator.ts):

```ts
aggregateLocalEvents(providers, params) → {
  merged: MergedCanonicalEvent[],       // canonicalized + merged (post-merge canonical rows)
  groups: CanonicalEventGroup[],        // 1:1 con merged, preserva members para persistence
  sourceReports: AggregatedSourceReport[], // un entry por provider (status, counts, warnings)
}
```

**Per-source isolation** vía `Promise.allSettled`: cada provider corre en paralelo; cualquier rejection se captura en `normalizeEnvelope` como envelope sintético `unavailable`, **nunca propaga**. El tick entero siempre produce un report aunque los 3 providers fallen.

**Defense-in-depth window filter**: después del normalize, se dropean candidates con `startsAt` fuera de `[window.from, window.to]` — aunque el provider haya ignorado el window.

### Canonicalize + merge

[canonicalize.ts](../../src/lib/services/local-events/canonicalize.ts) implementa un **3-tier matcher** cross-source:

1. **Strong match** — `normalizeTitle` exacto + mismo `startSlot` (15-minute floor de `startsAt.getTime()`) + igualdad de `normalizeVenue` solo cuando ambos lados lo exponen (si un lado omite venue, title+slot basta).
2. **Heuristic match** — `startSlot` dentro de ±4 slots (60 min) + Jaccard de tokens de título ≥ 0.60 + acuerdo de venue exacto **o** proximidad geográfica ≤500m (`haversineMeters` desde `places/distance.ts`). Genera warning `heuristically merged ... — verify`.
3. **No match** — se quedan como canonical groups separados (dedupe conservador: preferimos duplicado visible a merge equivocado).

`canonicalKey` = `createHash("sha256").update(parts).digest("hex").slice(0, 20)` sobre `normalizedTitle|startSlot|normalizedVenue` — estable across ticks mientras el título normalizado, el slot de 15min y el venue normalizado no cambien.

**Merge per-field**:

- `title` / `descriptionMd` / `categoryKey` / `startsAt` / `endsAt` / `venueName` / `venueAddress` / `lat` / `lng` / `priceInfo` → wins el source con mayor priority (PredictHQ).
- `sourceUrl` → **exception**: TM wins si está presente (deep-links a venta directa son más valiosos que aggregator URLs).
- `imageUrl` → **exception**: Firecrawl wins si está presente (scraped images suelen ser mejor que stock aggregator).
- `confidence` → max de los contributors.
- `contributingSources[]` → union ordenada por priority.
- `mergeWarnings[]` → accumula cuando dos sources tienen venue distinto pero el matcher los fusionó (señal para revisión manual futura).

### Sync service

[sync.ts](../../src/lib/services/local-events/sync.ts) — `syncLocalEventsForProperty({propertyId, aggregated, tickStartedAt, prisma?})` corre dentro de un único `prisma.$transaction(callback)`:

1. **Pre-load** existing events (`(propertyId, canonicalKey)`) + existing links (`(propertyId, source, sourceExternalId)`) en el scope.
2. **Classify**: cada `merged[i]` + `groups[i]` produce un upsert de `LocalEvent`. Cross-reference contra pre-loaded para counts `eventsCreated` vs `eventsUpdated`.
3. **Links upsert**: acumula `tickLinkKeys: Set<source|sourceExternalId>` mientras upserta cada link candidato. Cross-reference contra `existingLinkBySourceKey` preloaded para counts `linksCreated` vs `linksUpdated`.
4. **Stale-link sweep (property-wide, una sola pasada tras todos los events)**: link stale = `(source, sourceExternalId)` que NO volvió a aparecer en este tick. Scope property-wide a propósito — si la canonicalización movió un link a un `eventId` distinto, su key sigue en `tickLinkKeys` y el link sobrevive. Borrar por `eventId` con el bucket pre-tick mis-borraría links recién reasignados.
5. **Retention sweep**: `deleteMany LocalEvent where propertyId AND lastSyncedAt < tick AND startsAt >= tick` — borra **solo eventos futuros** no re-surfaced en este tick. Los eventos pasados se conservan como histórico.

**Invariante**: `merged.length === groups.length` — si no, throw. Los groups llevan los `members` (NormalizedEventCandidate originales) necesarios para crear los links.

**JSON semantics**: `priceInfo` usa `value ?? Prisma.DbNull` — cuando falta, persiste SQL NULL en la columna (no un valor JSON `null`, cuya semántica correspondería a `Prisma.JsonNull`).

Report: `{eventsCreated, eventsUpdated, eventsDeleted, linksCreated, linksUpdated, linksDeleted}`.

### Scheduler + cron

[scheduler.ts](../../src/lib/services/local-events/scheduler.ts) — `runLocalEventsTick({now?, horizonDays?, providers?, db?})`:

- **Property scan**: `prisma.property.findMany({where: {latitude: {not: null}, longitude: {not: null}}})`. Properties sin coords se omiten silenciosamente.
- **Providers instantiated ONCE per tick** (Firecrawl cache reuse). `buildProvidersFromEnv()` siempre devuelve los 3; claves missing producen `config_error` envelopes al llamar `fetch`.
- **Window**: `[now, now + 60 days]`.
- **Locale**: `property.defaultLocale === "en" ? "en" : "es"`.
- **Per-property isolation**: cada propiedad corre en su propio `try/catch`. Un fallo DB en una propiedad produce `perProperty[i].error` sin halt del tick.

Report: `{now, propertiesScanned, perProperty: [{propertyId, propertyNickname, sourceReports, mergedEventsCount, sync, error?}], providersConfigured, horizonDays}`.

[src/app/api/cron/local-events/route.ts](../../src/app/api/cron/local-events/route.ts) — `POST /api/cron/local-events` con `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Mirror exacto del patrón de messaging cron:

- 500 `cron_secret_not_configured` si falta `process.env.CRON_SECRET`
- 401 `unauthorized` si falta/malformado/mismatch del Bearer
- 200 `{ok: true, report}` en éxito

Schedule en `vercel.json`: `0 4 * * *` (daily 04:00 UTC).

### Data model (events)

Ver `docs/DATA_MODEL.md` para los modelos `LocalEvent` y `LocalEventSourceLink`.

### Env vars (events sync)

```bash
# Keys para los 3 sources. Missing keys = non-fatal: provider degrade a
# config_error envelope y el aggregator continúa con las restantes. Tick
# con 0 keys válidas sigue siendo 200, report lleva 3 config_error entries
# por propiedad.
PREDICTHQ_API_KEY=
FIRECRAWL_API_KEY=
TICKETMASTER_API_KEY=
CRON_SECRET=     # compartido con messaging cron
```

### Cómo añadir un nuevo source

1. Implementar `LocalEventSourceProvider` en `src/lib/services/local-events/<name>-provider.ts` + mapping nativo → `le.*` en archivo propio.
2. Añadir entry a `PROVIDER_PRIORITY` en [contracts.ts](../../src/lib/services/local-events/contracts.ts) (decide priority vs. las existentes; si quieres ganar `sourceUrl` o `imageUrl` por encima de TM/Firecrawl, añadir excepción explícita en `canonicalize.ts`).
3. Extender `buildProvidersFromEnv` en `scheduler.ts` para instanciarlo con su env key.
4. Añadir entry a `.env.example` con semántica de degradación documentada.
5. Tests: happy path, config_error sin key, rate_limited, parse_error con body malformado.

## Embedded maps + event listing (Rama 13C — `feat/guide-maps-embedded`)

`gs.local` en `/g/[slug]` se renderiza con dos sub-componentes adicionales además de los `LocalPlace` cards existentes:

1. **Mapa interactivo** (`<GuideMap>`, client island con MapLibre) — zona obfuscada de la propiedad + pines de lugares y eventos.
2. **Listado temporal de eventos** (`<GuideLocalEventCard>`) — eventos en ventana `[-24h, +30d]`, ordenados por `startsAt` ASC, incluye eventos sin coords (marcados "Sin ubicación exacta").

### Invariantes de seguridad

- `Property.latitude/longitude` **nunca** llegan al cliente para `audience=guest`/`ai`. `buildGuideMapData` (en [src/lib/services/guide-map.service.ts](../../src/lib/services/guide-map.service.ts)) llama a `obfuscateAnchor` (ver `map-obfuscation.ts`), que genera un offset radial determinístico `[0.31r, r]` por `propertyId` (radio por defecto 300 m) con corrección `cos(lat)` para mantener distancias reales en metros a cualquier latitud. El tipo `GuideMapAnchor` es una unión discriminada: `{obfuscated: true, lat, lng, radiusMeters} | {obfuscated: false, lat, lng}` — `radiusMeters` solo existe en la variante obfuscada.
- `audience=sensitive` corta antes: `buildGuideMapData` retorna `null`, `buildGuideLocalEventsData` retorna `{items: []}`.
- `LocalPlace` pasa por `isVisibleForAudience(place.visibility, audience)` (defense-in-depth aunque el row ya tenga `visibility: guest`).
- `LocalEvent` no tiene columna `visibility` hoy. Se trata como implícitamente guest-visible porque el sync solo lee proveedores públicos (§ Events data model). Si se añadieran eventos privados en el futuro, habría que añadir columna + filtro — documentado arriba en `docs/SECURITY_AND_AUDIT.md` §2.

### Ventana temporal

Pines de eventos y listado comparten la misma ventana: `[now - 24h, now + 30d]`. El lower bound de -24h preserva festivales de varios días que ya empezaron. Constantes `EVENT_WINDOW_PAST_MS` / `EVENT_WINDOW_FUTURE_MS` en `guide-map.service.ts`.

### Pipeline de datos

- `buildGuideMapData(propertyId, audience, opts?)` — spatial: anchor + pines con coords en ventana. `GuideMapPin` es unión discriminada por `kind`: `"place"` lleva `distanceMeters` opcional; `"event"` lleva `startsAt` (ISO). El tipo garantiza que `startsAt` no aparece en pines de lugar.
- `buildGuideLocalEventsData(propertyId, audience, opts?)` — temporal: mismos eventos en ventana, incluyendo los sin coords, con `hasCoords` boolean + sort ASC defensivo.
- Ambas funciones llaman a helpers cacheados (`React.cache`) en [guide-local-data.ts](../../src/lib/services/guide-local-data.ts); el resolver interno (`resolveLocal` en `guide-rendering.service.ts`) usa los mismos helpers, por lo que un render de `/g/[slug]` hace **una** query por tabla (`LocalPlace` + `LocalEvent`) aunque dos subsistemas la consuman.

### Tiles + fallback

MapLibre consume `/api/geo/tiles-config`. Sin `MAPTILER_API_KEY` el endpoint responde 503 y el client island degrada a un fallback textual ("Mapa no disponible") sin romper el render del resto de la sección. La key se comparte con el autosuggest (rama 13A) — una única cuenta MapTiler cubre geocoding + tiles.

### Flags de taxonomía

`taxonomies/guide_sections.json` entry `gs.local` lleva `"includesMap": true` + `"includesEvents": true`. Los flags están en el schema de `GuideSectionConfigSchema` (opcionales + default false) para permitir activar/desactivar cada sub-componente sin tocar código en el futuro.

### Renderers string (HTML/Markdown/PDF)

Los exportadores estáticos no intentan renderizar tiles ni cards de eventos: emiten un placeholder textual "Mapa y próximos eventos disponibles en la guía online." después de los `LocalPlace` items cuando `section.resolverKey === "local"`.
