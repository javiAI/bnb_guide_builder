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

11B deja la política "missing locale → fallback con nota visible". Extensión futura: botón "Traducir automáticamente con IA" (Claude Sonnet + validación humana obligatoria antes de marcar como `published`). DeepL como alternativa más barata para texto corto. Evitar auto-publicar sin revisión.

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
