# FUTURE — Trabajo diferido

Items con trigger condicional. **No son el roadmap activo** (ver `ROADMAP.md` + `MASTER_PLAN_V2.md`), pero están planificados y documentados para cuando llegue su momento.

---

## 1. Admin UI para taxonomías

**Estado**: diferido.
**Trigger para activar**: alguien no-técnico necesita editar taxonomías en producción, o el volumen de cambios en `taxonomies/` supera ~5 PRs/semana.

### Por qué existe el plan

Hoy editar una taxonomía requiere `vim taxonomies/*.json` → commit → PR → merge → redeploy. Flujo perfecto para un equipo técnico con Git, pero bloqueante cuando:

- Personas no técnicas (operadores, contenido, clientes white-label) deben editar taxonomías.
- Se necesita validar impacto antes de borrar/renombrar un key (ej: cuántas properties usan `am.X`).
- Se quiere versionado/rollback de taxonomía independiente del código.

### Qué ya funciona solo (editar JSON + restart)

| Concepto | Auto-render |
|---|---|
| Amenities (listado, subtypes, grupos) | ✅ |
| Tipos de espacio + features por espacio | ✅ |
| Systems + subtypes | ✅ |
| Dependencias entre campos (`dynamic_field_rules`) | ✅ |
| Wizard steps y section editors | ✅ |

No auto-renderizado (requiere código): tipo de campo nuevo (ej `color_picker`), sección nueva en sidebar (`icon-registry` + `renderer-registry`), taxonomía nueva (1 línea en `taxonomy-loader.ts`). Tests `config-driven.test.ts` fallan si olvidas alguno.

### Niveles de ambición

**Nivel 0 — Script de lint + impacto (1 día)**
`pnpm taxonomy:lint`: valida JSON contra Zod, diff vs `main`, cuenta impacto en DB. 80% del valor por 5% del esfuerzo. Recomendado como primer paso siempre.

**Nivel 1 — Editor web MVP (3-5 días)**
Ruta `/admin/taxonomies` (RBAC). Server action escribe JSON + `revalidatePath`. Solo dev o deploy con FS escribible.

**Nivel 2 — Taxonomías en DB (2-3 semanas)**
Mover las 28 taxonomías a Prisma (`Taxonomy`, `TaxonomyItem`, `TaxonomyField`, `TaxonomyRule`). Loader lee de DB con caché. Audit log reemplaza git history. Preservar mappings Airbnb/Booking en schema.

**Nivel 3 — Admin completo (1-2 meses)**
Nivel 2 + validación de impacto en vivo + migraciones en línea (rename `am.X → am.Y` con bulk-update) + sandbox/preview + RBAC granular + versionado semántico.

Independientemente del nivel elegido, **arrancar siempre por Nivel 0**.

---

## 2. Platform integrations (Airbnb / Booking.com)

**Estado**: ✅ **Fase 14 cerrada** (14A–14E) + closed-loop apply en 15E. Documentación viva en [docs/FEATURES/PLATFORM_INTEGRATIONS.md](FEATURES/PLATFORM_INTEGRATIONS.md). Lo que queda en este apartado es solo el work diferido más allá del MVP.

### Lo que ya hay

- 14A — auditoría real de mappings (194 ítems, 161 con mapping a Airbnb o Booking, 33 `platform_supported: false`). Shape `PlatformMapping` (`external_id` / `structured_field` / `free_text` / `room_counter`). Invariante en `src/test/platform-mappings-coverage.test.ts`.
- 14B/14C — exports Airbnb + Booking (serializers contra schema, validación, snapshot tests).
- 14D — import reader + diff bidireccional (detecta conflictos, no sobrescribe a ciegas).
- 14E — UI de import en dashboard.
- 15E — closed-loop `applyImportDiff` con audit `action=import.apply` + idempotency fingerprint, gateado por `withOperatorGuards`.

### Diferido a futuro

- **OAuth real con Airbnb/Booking**: hoy el import usa subida manual del JSON. Trigger: aprobación de partners API + decisión de producto sobre tier de hosts profesionales.
- **Sync periódico bidireccional**: hoy es export-on-publish + import-on-demand. Trigger: hosts gestionando >5 propiedades pidiendo refresh automático.
- **Reconciliación cross-platform** (mismo listing en Airbnb + Booking): detectar divergencias entre las dos OTAs y proponer reconciliación. No prioritario.

---

## 3. Calibración de completeness (7C del plan original)

**Estado**: measurement-dependent. Diferido hasta tener ≥10 propiedades reales con datos.

Ajustar pesos y umbrales en `taxonomies/completeness_rules.json` según uso real. No es trabajo técnico — es medición + tuning. La extracción a JSON ya está hecha (rama **8A** completada): las reglas son editables sin redeploy y validadas con Zod en el loader.

---

## 4. Revelado condicional de contenido sensible (post-MVP)

**Estado**: diferido.
**Trigger**: si los logs muestran que >5% de huéspedes acceden a `/g/:slug` antes del check-in y leen `wifi_password` o `door_code` prematuramente (riesgo de difusión no-autorizada).

Hoy la visibility es binaria por audience (`guest | ai | internal | sensitive`). Un futuro "timeline-based visibility" ocultaría `wifi_password` hasta `arrivalDate - 4h`, `door_code` hasta `arrivalDate`, post-checkout purga los secretos de la sesión. Requiere fecha de reserva conocida en el slug (firmado) y expiración automática.

---

## 5. Journey-stage aware UI

**Estado**: diferido.
**Trigger**: cuando la guía tenga tráfico real y se puedan medir patrones de consulta por stage.

La taxonomía `journeyStage` (`pre_arrival | arrival | stay | checkout | post_checkout`) se introduce en **11A**. Hoy se usa solo como filtro del retriever (servidor). Una segunda capa futura: el renderer de la guía pública (10E) resalta/reordena secciones según el `journeyStage` detectado (`now - arrivalDate`), sin cambiar la URL. Requiere `arrivalDate` en el slug firmado.

---

## 6. Upsells contextuales en la guía

**Estado**: diferido.
**Trigger**: decisión de producto de monetizar tráfico de la guía pública.

Colocar tarjetas no-intrusivas ("¿Reservar desayuno?", "Transfer al aeropuerto") en secciones específicas. Requiere modelo `Upsell` + trigger engine (reusa patrón de 12B) + estudio de UX para no degradar la guía. Ver [GUEST_GUIDE_SPEC.md](research/GUEST_GUIDE_SPEC.md) para contexto de oportunidad.

---

## 7. Brand theming avanzado

**Estado**: diferido.
**Trigger**: demanda real de white-label / host profesional quiere control visual pleno.

10E introduce brand theming MVP: logo + primary color. Extensión futura: tipografía secundaria custom, dark mode per-property, patrones de fondo, variantes por stage. Conservar el constraint de tokens de `src/config/design-tokens.ts` como único sitio donde se declaran variables CSS.

---

## 8. Analytics dashboard de la guía pública

**Estado**: diferido.
**Trigger**: >50 properties publicadas o demanda explícita de hosts.

10F introduce tracking MVP lightweight vía `POST /api/g/:slug/_track` (no-op inicial). Extensión futura: dashboard `/properties/[id]/analytics` con top secciones, tasa de apertura por journey stage, tasa de resolución de issues (13D), tiempo a primer contacto. Requiere agregación + rango temporal + export CSV.

---

## 9. Video optimization pipeline

**Estado**: diferido.
**Trigger**: >10% de las medias uploaded son video (medir tras Fase 10).

10D/10E soportan video en galería como blob directo en R2 (sin transcoding). Extensión futura: transcoding a HLS adaptive bitrate via Mux o Cloudflare Stream, thumbnail automático, captions auto-generados. Costo de integración no justificado hasta que el volumen lo pida.

---

## 10. Auto-translate de KnowledgeItems con LLM

**Estado**: diferido.
**Trigger**: host con >3 idiomas activos se queja del coste manual de traducción.

11B (merged) deja la política de fallback: `getItemForLocale` devuelve el item del `defaultLocale` con `_fallbackFrom` cuando el locale pedido no existe; la UI muestra tabs con dot de estado (missing/present) y banner de warning cuando hay ítems sin traducir. `invalidateKnowledgeInBackground` solo re-extrae el `defaultLocale`; los locales no-default se vuelven stale si el host edita la propiedad sin regenerar manualmente.

Extensión futura: botón "Traducir automáticamente con IA" (Claude Sonnet + validación humana obligatoria antes de marcar como `published`). DeepL como alternativa más barata para texto corto. Evitar auto-publicar sin revisión.

---

## 11. Liora Design Replatform

**Estado**: preparado — plan de ejecución completo en [MASTER_PLAN_V2.md § FASE 16](MASTER_PLAN_V2.md) (7 ramas 16A-G).
**Trigger para activar**: entrega del paquete de diseño Liora (tokens + primitivos + superficies).

Las reglas anti-legacy que protegen la frontera del replatform ya están vigentes hoy — ver [ARCHITECTURE_OVERVIEW.md §14](ARCHITECTURE_OVERVIEW.md). Docs y skills específicos (`docs/LIORA_DESIGN_ADOPTION_PLAN.md`, `docs/LIORA_MIGRATION_RULES.md`, `docs/LIORA_COMPONENT_MAPPING_TEMPLATE.md`, `docs/LIORA_SURFACE_ROLLOUT_PLAN.md`, eventualmente skills `/liora-*`) **no existen todavía** — se crean al arrancar rama 16A junto con el paquete de diseño.

---

## 12. Image resize/optimization on upload

**Estado**: diferido (ya mencionado en ROADMAP).
**Trigger**: coste de R2 + bandwidth crece visiblemente con fotos HD subidas directamente.

Sharp (server-side) o Cloudflare Image Resizing. Genera variantes `thumb | medium | full` al confirmar upload. El media proxy de 10D ya contempla el parámetro `:variant`, por lo que el front-end no cambia cuando se active esto.


---

## 13. Service worker lifecycle E2E tests

**Estado**: diferido. Decisión tomada en kickoff de Rama 10I: no se testea en headless por flake típico.
**Trigger para activar**: CI en prod tiene flake rate < 2% en tests de network interception, o el equipo identifica un regression de lifecycle que los unit tests no atraparon.

### Por qué se diferió

El SW lifecycle (install → activate → fetch intercept → offline replay → version invalidation) es difícil de testear de forma fiable en headless Chromium. Playwright puede controlar Service Workers vía `context.serviceWorkers()`, pero:

- La secuencia install → activate → claim puede tardar más que el timeout razonable.
- Dos navegaciones consecutivas a la misma URL bajo SW scope causan `net::ERR_FAILED` en headless WebKit.
- La invalidación real (vieja cache eviccionada, nueva precacheada) requiere múltiples reloads en la misma pestaña, lo que interacciona con `skipWaiting` de formas que varían entre engines.

Los unit tests (`guide-sw-template.test.ts`, `guide-sw-precache-manifest.test.ts`, `guide-sections-cache-tier.test.ts`) cubren el template source y la lógica declarativa. Los E2E actuales validan HTTP seams (manifest/sw endpoints) + DOM (nudge) + axe.

### Qué cubriría cuando se active

1. **Offline replay**: navegar a `/g/e2e/rich/`, esperar SW active, desconectar network, navegar de nuevo → tier-1 sections visibles desde cache.
2. **Invalidación de versión**: registrar SW con versión A, publicar versión B (diferente `buildVersion`), navegar → browser detecta SW body distinto → update flow completa → caches de versión A eliminadas.
3. **Offline shell fallback**: intentar navegar a ruta no cacheada offline → `handleNavigation()` devuelve `/offline`.

### Implementación sugerida

- Chromium-only (webkit excluido): `playwright.config.ts` con proyecto `chromium-sw-lifecycle`.
- `page.context().serviceWorkers()` + `.waitForEvent("serviceworker")` para esperar install.
- `context.setOffline(true)` para simular desconexión.
- Un fixture E2E con `buildVersion` controlado (o dos slugs de fixture con trees distintos) para probar invalidación.
- Separar en archivo propio (`e2e/guide-sw-lifecycle.spec.ts`) y marcar `testInfo.skip()` si `process.env.CI_SW_LIFECYCLE !== "1"` para no bloquear el pipeline principal.

---

## 14. Retirar mocks del pipeline del assistant

**Estado**: diferido hasta que todos los entornos de CI/staging/prod tengan `VOYAGE_API_KEY`, `COHERE_API_KEY` y `ANTHROPIC_API_KEY` aprovisionadas y el banco de evals (rama 11E) corra contra providers reales con fixtures cacheadas.
**Trigger para activar**: las tres claves están en CI (secrets) + staging + prod, y el release gate de 11E pasa contra providers reales sin dependencia del mock.

### Qué hay hoy (rama 11C)

El pipeline degrada silenciosamente en dev/test cuando falta alguna de las tres claves:

| Provider | Mock de fallback | Archivo |
|---|---|---|
| Voyage embeddings (`voyage-3-lite`, 512d) | Mock determinístico: hash SHA-256 del texto → seed → 512 floats L2-normalizados | `src/lib/services/assistant/embeddings.service.ts` |
| Cohere Rerank 3 multilingual | Identity reranker (devuelve top-K sin reorden) | `src/lib/services/assistant/reranker.ts` |
| Anthropic synthesizer (Sonnet) | Stub que emite respuesta fija más cita única de la primera evidencia | `src/lib/services/assistant/synthesizer.ts` |

En `NODE_ENV=production` el pipeline ya **no** cae a los mocks: hace fail-fast si falta cualquiera de las claves.

### Por qué el mock existe

- Permite correr tests de retrieval/pipeline sin coste ni dependencia de red.
- Permite que un developer arranque el repo sin aprovisionar tres SaaS.
- Hace determinístico el banco de fixtures vitest (sin flaky por latencia o cambio silente de modelo en provider).

### Por qué acabará retirándose

- El mock de embeddings no refleja la topología real del espacio (clusters semánticos reales). Tests que dependan del mock como "aproximación de la verdad" pueden enmascarar regresiones silenciosas de retrieval cuando la API real cambia.
- El identity reranker no valida integración con Cohere; si Cohere rota endpoint o ajusta scoring, nadie se entera hasta prod.
- El synthesizer stub hace que tests de prompt injection y tests de citation quality sean falsamente verdes.

### Qué cubriría la retirada

1. Borrar los 3 providers mock (`MockEmbeddingsProvider`, identity reranker, synthesizer stub).
2. Eliminar la rama `if (!process.env.X_API_KEY) return mock…` en los tres servicios.
3. Actualizar tests vitest para usar fixtures cacheadas de respuesta (grabadas contra providers reales) — coordinar con 11E (`src/test/assistant-evals/fixtures.json`).
4. Documentar en `CLAUDE.md` que arrancar el repo sin las tres claves ya no funciona.
5. Garantizar que el release gate de 11E sigue verde con la nueva configuración.

Retirar el mock antes de tiempo rompe dev local y CI — **no lanzar sin el trigger completo**.

---

## 15. Per-contact `escalationIntents[]` override

**Estado**: diferido.
**Trigger**: un host quiere asignar un `Contact` a un intent de escalation específico sin pasar por el matching `roleKey → contactRoles[]` de `escalation_rules.json` (ej: una gestora de apartamentos que tiene una concierge de confianza para lockouts aunque su `roleKey` sea `ct.host`).

### Cómo funciona hoy (rama 11D)

La resolución de contacto por intent vive en `taxonomies/escalation_rules.json`: cada intent declara `contactRoles[]` (listado de `roleKey` permitidos). `resolveEscalation({intentId})` hace `prisma.contact.findMany({ where: { roleKey: { in: contactRoles } } })` + orden + filtro de visibility. El host puede priorizar contacts dentro de un role (vía `isPrimary` + `sortOrder`), pero **no puede** mapear un contact a un intent para el que su `roleKey` no cualifica.

### Qué añadiría el override

Columna nueva en `Contact`: `escalationIntents String[] @default([])`. Si tiene valores, el service los considera candidatos **además** del match por `roleKey`. Resolución final:

```text
candidates = [
  ...contacts WHERE roleKey IN intent.contactRoles,
  ...contacts WHERE $intentId = ANY(escalationIntents)
]
```

Dedupe por `id`, mismo orden determinístico (`emergencyAvailable > isPrimary > sortOrder > createdAt`).

### Por qué no está en 11D

- El patrón `roleKey + taxonomía central` cubre el 95% de casos (una propiedad tiene un cerrajero → `ct.locksmith` → intent `int.lockout`). Override solo gana cuando hay ambigüedad real, y hoy no hay ninguna reportada.
- Añadir una columna nullable a `Contact` requiere migración + UI en el editor de contactos + documentación + tests de cascada. Trabajo no trivial sin demanda.
- El intent resolver (heurística pura) ya pasa el precision gate sin esta capa. Añadirla sin necesidad complicaría el contrato sin beneficio medible.

### Qué cubriría la implementación

1. Migración Prisma: `escalationIntents String[] @default([])` en `Contact`.
2. UI en el editor de contactos: multi-select sobre intents de `escalation_rules.json` (opcional, vacío por defecto).
3. Ampliar `resolveEscalation` con la rama de override (query adicional + dedupe).
4. Tests de cascada: override gana sobre contactType-match cuando hay empate; no rompe el orden determinístico.
5. Doc en `KNOWLEDGE_GUIDE_ASSISTANT.md §5 Escalation`.

Sin demanda explícita, la taxonomía central es mejor por claridad y consistencia cross-property. **No lanzar sin el trigger.**

## 16. Hook de starter pack en el onboarding wizard

### Cómo funciona hoy (rama 12C)

Los 6 starter packs se aplican vía `StarterPackPicker` **exclusivamente** desde `/properties/[propertyId]/messaging`. Al terminar el wizard, una propiedad nueva entra en messaging con `templateCount === 0 && !hasPackRows` → se muestra el banner "Empieza con un pack" como CTA principal. El host elige tone + locale, previsualiza y aplica.

### Qué añadiría el hook del wizard

Un paso al final del wizard (o un campo en un paso existente) para preseleccionar tone + locale y llamar a `applyStarterPackAction` al marcar `completeWizardAction`. Flujo esperado:

1. Wizard añade `defaultMessagingTone` + `defaultMessagingLocale` al schema de onboarding.
2. `completeWizardAction` hace un `applyStarterPack({ packId: pickPack(tone, locale), propertyId })` dentro del mismo `$transaction` que crea la property.
3. El host aterriza en messaging con templates + automations ya cableadas (inactivas), salta el empty-state, revisa y activa.

### Por qué no está en 12C

- El scope aprobado de 12C fue explícitamente "solo CTA en `/messaging`, wizard hook diferido". Añadirlo ahora tocaría `wizard-steps.ts`, `wizard.schema.ts`, `wizard.actions.ts`, más tests de regresión del wizard — sin datos de usage que confirmen que acelera el onboarding.
- El empty-state CTA en messaging ya cubre el caso. Cero fricción extra para hosts que no quieran auto-seed.
- El hook pierde valor si el wizard cambia de estructura (Fase 16 — Liora replatform) y habría que rehacerlo.

### Qué cubriría la implementación del wizard hook

1. Campo `defaultMessagingPackId` (o `tone + locale`) en el último paso del wizard.
2. Llamada a `applyStarterPack` al final de `completeWizardAction`, dentro del transaction que crea la property (o post-commit, gated por una flag).
3. Copy en el wizard: "Empieza con mensajería automática cableada" + preview de los 3 tones con sample body.
4. Tests: wizard complete con pack id → property tiene 7 templates `origin="pack"` + 7 automations inactivas.
5. Doc en `MESSAGING_AUTOMATION.md §6.4`.

Sin demanda explícita y sin métricas de conversion del empty-state actual, el hook queda pospuesto.

## 17. Google Places provider para POI autosuggest

### Cómo funciona hoy (rama 13A)

El autosuggest de POIs usa `LocalPoiProvider` — una abstracción agnóstica con dos implementaciones: `MapTilerPlacesProvider` (prod) y `MockPlacesProvider` (dev/test). La selección va por `LOCAL_POI_PROVIDER` env var (default `maptiler`). El mapeo de categorías nativas → `lp.*` vive en un archivo aparte (`maptiler-category-mapping.ts`) con patterns priorizados. Ver `docs/FEATURES/LOCAL_GUIDE.md`.

### Qué añadiría Google Places

Implementación paralela `GooglePlacesProvider` para hosts en mercados donde MapTiler tiene baja cobertura de POI (p.ej. LatAm). Google Places Autocomplete + Place Details tiene mejor cobertura absoluta pero pricing por request distinto (≈ $17/1000 autocomplete + details vs MapTiler $0.25/1000 geocoding).

### Scope de implementación

1. `src/lib/services/places/google-provider.ts` — implementa `LocalPoiProvider` con la Autocomplete + Details API (la UI actual espera un solo call con lat/lng resuelto, así que Details es obligatorio).
2. `src/lib/services/places/google-category-mapping.ts` — mapeo de `types[]` (`restaurant`, `supermarket`, `pharmacy`, ...) → `lp.*`.
3. `resolveLocalPoiProvider()` extendido con un tercer branch `envChoice === "google"` + fingerprint update (`GOOGLE_PLACES_API_KEY`).
4. Contract test compartido (`src/test/places-provider-contract.test.ts`) pasando factory de Google.
5. Tests de parsing + mapeo + error paths (plantilla: `places-maptiler-provider.test.ts`).

### Por qué no está en 13A

- Un solo provider cubre el caso general; añadir Google sin demanda concreta = mantener dos integraciones (rate limit, billing, keys).
- El contrato provider-agnostic ya está sellado — añadir Google es aditivo, no refactor.
- La UI y el pipeline ignoran qué provider respondió (solo queda `provider` persistido en `LocalPlace.provider` para auditoría).

Esperar demanda de un mercado concreto antes de escribir el segundo provider.
