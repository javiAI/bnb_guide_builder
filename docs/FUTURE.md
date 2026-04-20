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

**Estado**: diferido.
**Trigger para activar**: decisión de producto sobre distribución multi-plataforma.

### Alcance

- Export: serializar Property + Spaces + Amenities + Policies a schemas Airbnb y Booking.
- Import: lectura inversa con reconciliación (detectar conflictos, no sobrescribir a ciegas).
- Mappings: todas las taxonomías ya tienen campos `source: [{platform: airbnb, external_id: …}]`; falta auditar cobertura.

### Pre-requisitos

- Fases 8-11 estables (core + outputs + knowledge).
- Credenciales y aprobación de partners API.
- Auditoría de mappings: confirmar que el 100% de IDs en `amenity_taxonomy`, `property_types`, `space_types`, `access_methods`, `policy_taxonomy` tienen equivalente documentado.

### Ramas previstas (Fase 14 en MASTER_PLAN_V2)

- `feat/platform-mappings-audit` — completar `source[]` donde falte
- `feat/airbnb-export` — serializer + validación contra schema Airbnb
- `feat/booking-export` — idem Booking
- `feat/platform-import` — reconciliación bidireccional

Esfuerzo estimado: XL (6-8 semanas en total).

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

**Estado**: preparado — plan de ejecución completo en [MASTER_PLAN_V2.md § FASE 15](MASTER_PLAN_V2.md) (7 ramas 15A-G).
**Trigger para activar**: entrega del paquete de diseño Liora (tokens + primitivos + superficies).

Las reglas anti-legacy que protegen la frontera del replatform ya están vigentes hoy — ver [ARCHITECTURE_OVERVIEW.md §14](ARCHITECTURE_OVERVIEW.md). Docs y skills específicos (`docs/LIORA_DESIGN_ADOPTION_PLAN.md`, `docs/LIORA_MIGRATION_RULES.md`, `docs/LIORA_COMPONENT_MAPPING_TEMPLATE.md`, `docs/LIORA_SURFACE_ROLLOUT_PLAN.md`, eventualmente skills `/liora-*`) **no existen todavía** — se crean al arrancar rama 15A junto con el paquete de diseño.

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
