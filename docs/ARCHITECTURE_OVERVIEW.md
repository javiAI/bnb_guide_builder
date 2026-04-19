# ARCHITECTURE_OVERVIEW

Versión: 2026-04-15
Autoridad: `version_3`
Idioma visible: español
IDs internos y código: inglés
Unidades: sistema métrico

Este documento es la fuente de verdad para el diseño del sistema: misión, capas, route map, ownership de escritura, reglas de sincronización y principios de producto. Sustituye y consolida a los anteriores `MASTER_IMPLEMENTATION_SPEC.md` y `SYSTEM_ARCHITECTURE.md`.

---

## 1. Executive output

- Objeto central: `Property`
- Contexto organizativo: `Workspace`
- Dos capas UX obligatorias:
  - alta rápida de propiedad usable
  - workspace posterior por módulos
- Regla de producto:
  - texto libre solo cuando no haya taxonomía razonable
  - una misma verdad de negocio no se captura dos veces
- Regla de seguridad:
  - `sensitive` nunca sale por defecto
- Regla de localización:
  - toda UI visible al operador y al huésped debe estar en español

## 2. Product mission

La aplicación debe servir, desde una única fuente de verdad, para:

1. crear y mantener una guía útil para huéspedes
2. producir una base de conocimiento fiable para AI
3. alimentar mensajes reutilizables y automatizables
4. soportar operación interna, limpieza, mantenimiento y revisión
5. publicar múltiples outputs sin reescribir contenido

## 3. Layers

### Product and UI

- App shell
- Property creation wizard (4 pasos + review)
- Property workspace modules
- Guest guide + AI view

### Application

- Route handlers / server actions
- Zod validation
- Permission and visibility enforcement
- Orchestration services

### Domain and persistence

- Prisma models
- Typed repositories
- Canonical entity services
- Audit logging

### Derived content

- Knowledge generation
- Guide versioning
- Publishing gates
- Messaging starter packs
- Review queue

### Retrieval and automation

- Assistant retrieval pipeline
- Message automation scheduler contract
- Output export services

## 4. Canonical UX model

### A. Entry and property creation

- Dashboard de propiedades
- Wizard inicial de 4 pasos + review
- Posibilidad de crear propiedad usable, guardar borrador o continuar más tarde

### B. Property workspace

Módulos canónicos (18):

1. Overview
2. Basics / Property
3. Arrival & access
4. Policies
5. Spaces
6. Amenities
7. Systems
8. Troubleshooting
9. Local guide
10. Knowledge base
11. Guest guide
12. AI view
13. Messaging
14. Publishing
15. Cleaning & ops
16. Media library
17. Analytics
18. Settings / Activity log

### C. Reusable outputs

1. Guest guide
2. AI knowledge export
3. Messaging pack
4. OTA snippets (Airbnb/Booking — futuro)
5. Internal ops pack

## 5. Route map

### Canonical routes

- `/`
- `/properties/new/welcome`
- `/properties/new/step-1`
- `/properties/new/step-2`
- `/properties/new/step-3`
- `/properties/new/step-4`
- `/properties/new/review`
- `/properties/:propertyId`
- `/properties/:propertyId/property`
- `/properties/:propertyId/access`
- `/properties/:propertyId/policies`
- `/properties/:propertyId/spaces`
- `/properties/:propertyId/amenities`
- `/properties/:propertyId/systems`
- `/properties/:propertyId/troubleshooting`
- `/properties/:propertyId/troubleshooting/:playbookKey`
- `/properties/:propertyId/local-guide`
- `/properties/:propertyId/knowledge`
- `/properties/:propertyId/guest-guide`
- `/properties/:propertyId/ai`
- `/properties/:propertyId/messaging`
- `/properties/:propertyId/messaging/:touchpointKey`
- `/properties/:propertyId/publishing`
- `/properties/:propertyId/ops`
- `/properties/:propertyId/media`
- `/properties/:propertyId/analytics`
- `/properties/:propertyId/settings`
- `/properties/:propertyId/activity`

### Public routes (no auth)

- `/g/:slug` — Guest guide (read-only, audience=guest forced). Resolves `Property.publicSlug` → latest published `GuideVersion.treeJson`, re-filtered to guest audience. `sensitive` and `internal` items are stripped server-side before render. Shows "guía no disponible" if no published version exists.
- `/g/:slug/media/:assetId-:hashPrefix/:variant` — stable public media proxy (Rama 10D). Decouples CDN-cached HTML from R2 presigned URL lifecycle (1h expiry). `:variant` ∈ `thumb`/`md`/`full`. Strong immutable cache when `contentHash` present (ETag = `"{contentHash}-{variant}"`), weak revalidating cache otherwise. Range requests propagate to R2 (206 partial content). Auth: 404 unless asset's property has `publicSlug = :slug` AND ≥1 published `GuideVersion`. See `docs/FEATURES/MEDIA_ASSETS.md` §7.

## 6. Source-of-truth rules

### Runtime taxonomies

Las opciones guiadas viven en `taxonomies/*.json`. Ver `CONFIG_DRIVEN_SYSTEM.md` para el listado completo y el contrato del loader.

### Canonical persisted entities

La verdad de negocio persistida vive en los modelos Prisma listados en `DATA_MODEL.md`. Resumen de write owners:

| Fact | Write owner |
|---|---|
| Property basics | `Property` service |
| Wizard capture (raw answers) | `WizardSession` + `WizardResponse` service |
| Spaces | `Space` service |
| Amenities | `PropertyAmenityInstance` + `PropertyAmenityPlacement` services |
| Systems | `PropertySystem` service |
| Troubleshooting | `TroubleshootingPlaybook` service |
| Incidents | `Incident` service |
| Local recommendations | `LocalPlace` service |
| Ops | `OpsChecklistItem`, `StockItem`, `MaintenanceTask` services |
| Media metadata | `MediaAsset` + `MediaAssignment` services |
| Knowledge items | Knowledge generation + manual editorial services |
| Guide versions | Guide composition service |
| Message templates | Messaging service |
| Automations | Messaging automation service |
| Assistant conversations | Assistant conversation service |
| Secrets | Vault integration + `SecretReference` metadata |
| Audit trail | Audit service |

### Derived layers

Son derivadas, no write owners:

- `PropertyDerived` cache
- Review queue
- Publish blockers
- Readiness cards
- Completeness scores
- AI export payloads
- Guest guide render trees
- `GuideVersion.treeJson` — snapshot inmutable del `GuideTree` al momento de publicar (audience=internal, se filtra al renderizar)

## 7. Synchronization rules

- Wizard save escribe raw responses y actualiza entidades canónicas en la misma transacción cuando sea posible.
- Derivados (`PropertyDerived`, publish blockers, completeness) se recomputan determinísticamente en cada mutación. No se editan a mano.
- Messaging starter packs se generan desde entidades canónicas pero quedan editables como templates independientes.
- Audit log almacena diffs estructurados; nunca payloads de secretos.
- Dual-write está prohibido post-MASTER_PLAN: toda lectura usa el modelo canónico.

## 8. Visibility model

Enum `VisibilityLevel` (ver `SECURITY_AND_AUDIT.md`):

- `guest` — reutilizable en guía pública y huéspedes confirmados
- `ai` — accesible al assistant con filtros por audiencia
- `internal` — solo operadores
- `sensitive` — secretos; nunca entran en `KnowledgeItem` ni salen por defecto

## 9. Wizard capture principle

El wizard no pregunta "cuéntame todo". Debe:

- Ofrecer opciones comunes primero
- Abrir follow-ups condicionados
- Permitir `Other / custom` solo cuando exista en taxonomía
- Pedir notas concisas y estructuradas
- Pedir fotos o vídeo solo cuando reduzcan fricción
- Explicar por qué cada dato importa

## 10. Messaging principle

Cada mensaje:

- Tiene un único objetivo
- Usa variables estructuradas
- Reutiliza conocimiento canónico
- Nunca incluye secretos por defecto
- Queda editable después de autogenerarse

## 11. Assistant principle

El assistant:

- Responde solo desde conocimiento soportado
- Devuelve citas máquina-legibles
- Filtra por propiedad, idioma, journey stage y visibilidad
- Escala si no hay soporte suficiente
- Bloquea peticiones de secretos

## 12. Release principle

No se considera estable una fase si falta cualquiera de:

- Modelo de datos alineado
- Validación de inputs (Zod)
- Tests relevantes (unit + integration)
- Release gates (ver `QA_AND_RELEASE.md`)
- Docs actualizados

## 13. Rendering model

### Guest guide

- Servicio: `composeGuide(propertyId, audience, publicSlug)` en `src/lib/services/guide-rendering.service.ts` devuelve un `GuideTree` tipado (`src/lib/types/guide-tree.ts`): `sections[] → items[] → fields[] / media[] / children[]`.
- Secciones declaradas en `taxonomies/guide_sections.json` (9 slots: essentials aggregator + arrival, spaces, howto, amenities, rules, checkout, local, emergency) + resolvers registrados por `resolverKey` — añadir sección = editar taxonomía + registrar resolver, nunca tocar componentes.
- Empty sections siempre presentes en el tree con `items: []`; `emptyCtaDeepLink` es `null` para `audience === "guest"` (host-panel links nunca expuestos al huésped) y la ruta resuelta con `propertyId` para audiences internas.
- Filtrado por audiencia delega en `canAudienceSee` (`src/lib/visibility.ts`) — aplicado a nivel item y a nivel field. `sensitive` nunca emitido por el resolver.
- Resiliencia: taxonomy keys desconocidas no rompen el render — el item se emite con `deprecated: true`, `label` = raw key, y un warning. Invariante enforced por `src/test/guide-no-hardcoded-ids.test.ts`.
- Output estable: `renderMarkdown(tree)` en `src/lib/renderers/guide-markdown.ts` + React renderer (10E) como canal principal para `/g/:slug`.

### Guest presentation layer (rama 10F — estable desde 2026-04-18)

**El filtrado por audiencia no es suficiente**: `canAudienceSee` controla *qué se ve*, no *cómo se ve*. Sin una capa terminal, un `policiesJson` viaja al huésped como JSON crudo, un enum `rm.smoking_outdoor_only` aparece como clave técnica, y un `emptyCopy` editorial ("Añade normas...") escrito para el host se muestra tal cual al huésped. La capa de presentación sella ese contrato.

**Pipeline canónico**: `composeGuide → filterByAudience → normalizeGuideForPresentation → render`.

- `normalizeGuideForPresentation(tree, audience)` es **pura, terminal e idempotente**: no consulta DB, no muta input, devuelve un `GuideTree` con `GUIDE_TREE_SCHEMA_VERSION = 3`. Se invoca también al servir `snapshotJson` pre-v3 (normalización al servir, sin rewrite en DB, con log `snapshotPreV3`).
- Cada `GuideItem` gana 4 campos opcionales: `presentationType?`, `displayValue?`, `displayFields?`, `presentationWarnings?`. El renderer consume `displayValue` / `displayFields` — nunca formatea desde `value` / `fields` raw. El fallback en `src/lib/renderers/_guide-display.ts` a `value`/`fields` es defensive-only para trees legacy pre-normalización.
- **Presenter registry** (`src/config/registries/presenter-registry.ts`): resolución exact `taxonomyKey` → longest-prefix match (`pol.*` → policy, `fee.*` → policy, `ct.*` → contact) → fallback `genericTextPresenter`. Coverage test (`presenter-coverage.test.ts`) falla si hay `taxonomyKey` en las taxonomías cubiertas sin presenter.
- Taxonomías extendidas: `guestLabel?`, `guestDescription?`, `icon?`, `heroEligible?`, `quickActionEligible?`, `guestCriticality?` se declaran en JSON, no en React. 10G/10H/10I los consumen; 10F los prepara sin consumirlos.
- `guide_sections.json` añade `emptyCopyGuest?` + `hideWhenEmptyForGuest?`. `emptyCopy` queda reservado para audience internal (copy editorial del host). **Nunca** se muestra copy editorial del host al huésped. `GuideRenderer` computa `filterRenderableItems` una sola vez y pasa `renderable` como prop a cada `SectionCard` / `GuideEmergencySection` — sin doble filter por sección.
- **Red defensiva en el normalizador**: `sanitizeGuestFields` descarta fields cuyo label está en `INTERNAL_FIELD_LABEL_DENYLIST` (`ReadonlySet<string>` exportado: `"Slot"`, `"Config JSON"`, `"Raw"`, `"Propiedad"`), cuyo value empieza por `{`/`[` (raw JSON), o cuyo value matchea `TAXONOMY_KEY_PATTERN`. El test de invariantes importa el set directamente; `GuideItem.tsx` tiene un `if (item.presentationType === "raw") return null` como defense-in-depth.
- **Invariantes anti-leak** (5 canónicas, sincronizadas con [QA_AND_RELEASE.md §3](QA_AND_RELEASE.md); tests en `src/test/guest-leak-invariants.test.ts` sobre `src/test/fixtures/adversarial-property.ts`, verificadas en tree + markdown + html):
  1. Ningún `displayValue` / `displayFields.value` en `audience=guest` empieza por `{` o `[` ni contiene sustring `"json":`.
  2. Ningún `displayValue` / `displayFields.value` en `audience=guest` coincide con `TAXONOMY_KEY_PATTERN = /^[a-z]+(_[a-z]+)*\.[a-z_]+$/`.
  3. `section.emptyCopy` no aparece en trees `audience=guest`; solo `emptyCopyGuest` cuando existe.
  4. Ningún `displayValue` / `label` / field en `audience=guest` está en `INTERNAL_FIELD_LABEL_DENYLIST`.
  5. Items con `presentationType === "raw"` en `audience=guest` no se renderizan (sentinel de bug + log `missing-presenter`).
- Schema evolution: `GUIDE_TREE_SCHEMA_VERSION = 2` → `3`. Snapshots pre-v3 se normalizan al servir.

### Client-side search (rama 10H — estable desde 2026-04-19)

Capa de descubrimiento *instant* sobre la guía pública. Coexiste con 11F (semantic retrieval) sin solaparse: 10H responde en p95 <20ms sin red con fuzzy match por sinónimos manuales; 11F responderá preguntas en lenguaje natural con embeddings + citations cuando haya conexión. Ver [KNOWLEDGE_GUIDE_ASSISTANT.md § Client search](FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md) para la tabla comparativa completa.

- **Server builder** (`src/lib/services/guide-search-index.service.ts`): `buildGuideSearchIndex(tree)` se ejecuta **después** de `normalizeGuideForPresentation("guest")` y lee solo el surface de presentación (`displayValue` / `displayFields[].displayValue`). Throw explícito si `tree.audience !== "guest"` — guard contra call-sites miswired.
- **Shape del index** (`src/lib/types/guide-search-hit.ts`): `{ buildVersion: string, entries: GuideSearchEntry[] }`. Cada entry lleva `id`, `anchor`, `sectionId`, `sectionLabel`, `label`, `snippet` (≤160 chars, ellipsis), `keywords` (label + snippet + `guide_sections.json → searchableKeywords[]`).
- **Anclas estables**: top-level items → `item-<id>`. Children flatten → `item-<parentId>--child-<idx>`. El DOM id se stampea en `GuideItem.tsx` y tiene que coincidir byte a byte con `entry.anchor` — parity es invariant load-bearing: si divergen, `Enter` hace scroll a ningún sitio.
- **Dedup aggregator**: items emitidos por secciones `isAggregator: true` (hero) se acumulan en un bucket separado y se mergean al final solo si su `id` no está ya en la sección canónica — preserva "anchor goes home, not to hero".
- **buildVersion**: SHA-1 truncado a 12 chars sobre `propertyId | generatedAt | entries.length` seguido de cada entry serializada como `id | label | snippet | keywords` (delimitadores `\x1f`). El contenido entra en el hash, no solo los ids — si un label/snippet/keyword cambia con los mismos ids, el hash rota y la PWA de 10I invalida. Determinístico para same input.
- **Client island** (`src/components/public-guide/guide-search.tsx`, `"use client"`): Radix Dialog + Fuse.js v7 (`threshold: 0.35`, `ignoreDiacritics: true`, `minMatchCharLength: 2`, keys `label ×2 / snippet ×1.5 / keywords ×1`). `useDeferredValue` desacopla el redibujo de la lista del tipeo. `/` abre desde cualquier parte (respeta `INPUT/TEXTAREA/SELECT/contentEditable` y modifier keys), `Escape` cierra, `Enter` navega al primer hit (scroll smooth + `history.replaceState`).
- **A11y**: combobox + listbox + option ARIA, `aria-activedescendant` en el input para lectores sin mover el caret, zero-result hint con `role="status"` + `console.info search-miss` (debounce 600ms, shim estable en `src/lib/client/guide-analytics.ts`). Tokens rebind en `.guide-search__dialog` porque Radix portaliza al `body`, fuera del scope de `.guide-root`. Axe-core `serious|critical = 0` enforced en `e2e/guide-search.spec.ts` a lo largo de los 4 proyectos Playwright.
- **No interactúa con 11F**: esa rama la consumirá como fallback cuando Fuse devuelva cero hits y haya red. El shim `trackSearchMiss` ya deja la señal lista.

### AI view

- Consume `KnowledgeItem` filtrado por visibility `guest` o `ai`
- Añade metadata de confianza, freshness y citations

### Messaging

- Consume `MessageTemplate`, `MessageAutomation`
- Variables resueltas desde datos canónicos y knowledge

## 14. Legacy management & migration discipline

Reglas operativas duras. Cada una tiene una consecuencia concreta ("la PR no mergea"); sin esas consecuencias, la regla no existe.

El motor de render (composiciones, presenter registry, renderers) es **agnóstico del skin** — sobrevive a cualquier replatform visual (Fase 15 Liora y futuros). Estas reglas protegen esa frontera.

1. **Duplicados por versión: prohibidos en `main`.**
   Nada de `*V2`, `*V3`, `New*`, `Next*`, `Better*`, `*Alt`, `*Redesign`, `*Old`, `legacy-*` como identificador de componente, módulo, archivo o export.
   **Consecuencia**: la PR que los introduzca no mergea. Si hay que cambiar la API de un componente, se cambia en su sitio (git conserva la historia).

2. **Toda migración de UI clasifica cada componente tocado.**
   En la description de la PR, tabla obligatoria `componente | reused | reskinned | rewritten | deleted`. `reskinned` = cambia el look, no la API. `rewritten` = cambia API o estructura interna. `deleted` = se borra en la misma rama o queda marcado para borrado en una rama de cleanup con fecha/ticket explícito.
   **Consecuencia**: PR sin tabla o con filas ambiguas no mergea.

3. **Convivencia legacy: solo con plan de retirada documentado.**
   Si por tamaño una rama introduce temporalmente una versión nueva junto a la legacy, la description de la PR debe incluir: (a) motivo, (b) plan de retirada, (c) rama o commit que borra la legacy, (d) fecha tope.
   **Consecuencia**: sin plan de retirada, la PR no mergea. Sin la rama/commit de retirada materializado antes de la fecha tope, la siguiente PR de esa área se bloquea hasta cerrarlo.

4. **"Painting over" prohibido.**
   Cambiar estilos a un componente (color, spacing, tipografía) solo es válido si el componente ya está mapeado al sistema de tokens y primitivos vigente. Parches puntuales inline en un componente no migrado no suman — se revierten y se canalizan por la rama de tokens o primitivos correspondiente.
   **Consecuencia**: la PR con parches inline de estilo se rechaza en review por estructura, no por mérito visual.

5. **Migración por capas: sin saltos.**
   Orden obligatorio: tokens → primitivos → shells → superficies → cleanup. Una PR de superficie no puede aterrizar si los primitivos que consume no están migrados; una PR de primitivos no puede aterrizar si los tokens que consume no están migrados.
   **Consecuencia**: PR que salta capas se rechaza y se re-plantea en la capa correcta.

6. **Accesibilidad es invariante, no replatformable.**
   WCAG 2.1 AA, axe-core `serious|critical = 0`, targets interactivos ≥44×44, contraste AA, landmark structure, focus management, keyboard navigation — se mantienen idénticos o se endurecen. Cualquier replatform (Liora incluido) que degrade a11y se rechaza.
   **Consecuencia**: axe-core con violaciones `serious|critical > 0` bloquea el merge directamente (ya enforced por el harness E2E de 10J).

7. **Tokens y mock-ups son MVP mientras Liora no esté activo.**
   Los tokens actuales en `src/config/design-tokens.ts` y los mock-ups en `docs/FEATURES/GUEST_GUIDE_UX.md` son referencias operativas — no ground-truth congelado. Las ramas funcionales en vuelo (10G/H/I, 11, 12, 13) **no consolidan decisiones visuales finales** y priorizan arquitectura + comportamiento + a11y + reuse de primitivos existentes sobre fidelidad visual.
   **Consecuencia**: una PR rechazada "por no seguir paleta futura" es un rechazo inválido. Una PR que introduce una familia nueva de componentes para consolidar visual MVP sí es motivo de rechazo (viola regla 1).
