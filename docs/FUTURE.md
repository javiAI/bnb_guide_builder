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

## 3. Field-type registry (tangencial, 1-2h)

**Estado**: pendiente (cheap win, encaja en Fase 8).

Refactorizar `SubtypeFieldInput` + `buildSubtypeFieldSchema` en un registry:

```ts
// src/config/registries/field-type-registry.ts
export const FIELD_TYPES = {
  boolean: { render: BooleanInput, validate: () => z.boolean() },
  enum:    { render: EnumInput,    validate: (f) => z.enum(f.options.map(o=>o.id)) },
  // ...
};
```

Añadir un tipo nuevo pasa de tocar 3 archivos a 1 entrada. Este refactor está incluido como **rama 8B** en `MASTER_PLAN_V2.md`.

---

## 4. Calibración de completeness (7C del plan original)

**Estado**: measurement-dependent. Diferido hasta tener ≥10 propiedades reales con datos.

Ajustar pesos y umbrales en `taxonomies/completeness_rules.json` según uso real. No es trabajo técnico — es medición + tuning. Pre-requisito: que las reglas estén extraídas a JSON (rama **8A** en `MASTER_PLAN_V2.md`).
