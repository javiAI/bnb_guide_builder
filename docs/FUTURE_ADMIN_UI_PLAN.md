# Plan futuro — Admin UI para taxonomías

Estado: **pendiente** (no planificado aún para ninguna fase).
Creado: 2026-04-15.
Contexto: conversación post-PR #29/#30 sobre facilidad de modificación del sistema.

## Por qué

Hoy editar una taxonomía requiere: `vim taxonomies/*.json` → commit → PR → merge → redeploy. Flujo perfecto para un equipo técnico con Git, pero bloqueante si:
- Otra persona no-técnica (operador, equipo de contenido, cliente white-label) debe editar taxonomías en producción.
- Se necesita validar impacto antes de borrar/renombrar (ej: cuántas properties usan `am.X`).
- Se quiere versionado/rollback de cambios de taxonomía independiente del código.

## Estado actual de la UI auto-renderizada

**Ya funciona automáticamente** al editar JSON + reiniciar server:

| Concepto | Renderer | Se actualiza solo |
|---|---|---|
| Amenities | `amenities/page.tsx` itera `amenityTaxonomy.items` | ✅ |
| Subtypes (forms de amenity) | `amenity-detail-panel.tsx` + `SubtypeFieldInput` | ✅ |
| Tipos de espacio | `spaces/page.tsx` itera `spaceTypes.items` | ✅ |
| Features por espacio | `space-card.tsx` itera `getSpaceFeatureGroups()` | ✅ |
| Sistemas | `systems/page.tsx` itera `systemTaxonomy.groups` | ✅ |
| Dependencias entre campos | `resolveFieldDependencies()` evalúa reglas | ✅ |

**No auto-renderizado** (requiere código):
- Tipo de campo nuevo (ej: `color_picker`) → `SubtypeFieldInput` + `buildSubtypeFieldSchema` + union en `types/taxonomy.ts`.
- Sección nueva en sidebar → `icon-registry.ts` + `renderer-registry.ts`.
- Taxonomía nueva (archivo JSON nuevo) → 1 línea en `taxonomy-loader.ts`.

Tests (`config-driven.test.ts`) fallan si olvidas alguno.

## Propuestas

### Nivel 0 — Script de lint + impacto (quick win, 1 día)

Comando `pnpm taxonomy:lint`:
- Valida cada `*.json` contra su Zod schema.
- Muestra diff legible vs `main`.
- Cuenta impacto en DB: cuántas filas de `PropertyAmenityInstance`/`Space`/`PropertySystem` usan cada key que se está modificando/borrando.
- Se ejecuta en CI en cualquier PR que toque `taxonomies/`.

**80% del valor de un admin UI por 5% del esfuerzo.** Recomendado como primer paso siempre.

### Nivel 1 — Editor web de taxonomías (MVP, 3-5 días)

Ruta `/admin/taxonomies` (protegida por RBAC).
- Listado + formulario por taxonomía.
- Guardar = server action que escribe el JSON al filesystem + `revalidatePath("/")`.
- Limitaciones: solo dev o deploy con FS escribible (Vercel serverless no).

### Nivel 2 — Taxonomías en DB (producción real, 2-3 semanas)

Mover las 28 taxonomías a tablas Prisma:
- `Taxonomy`, `TaxonomyItem`, `TaxonomyField`, `TaxonomyRule`.
- `taxonomy-loader.ts` lee de DB con caché en memoria (invalidar en save).
- Admin UI hace CRUD estándar.
- Ventajas: editable en prod, versionado, audit log, rollback, multi-tenant.
- Desventajas: pierdes git history de cambios (se sustituye por audit log DB), +latencia (mitigable con caché LRU).

**Consideración importante**: todas las taxonomías tienen mappings de plataforma (Airbnb/Booking) — hay que preservarlos en el schema DB.

### Nivel 3 — Admin completo con safety rails (1-2 meses)

Nivel 2 más:
- Validación de impacto en vivo al borrar/renombrar.
- Migraciones en línea: rename `am.X → am.Y` con bulk-update de filas afectadas.
- Sandbox/preview: editar en "rama de taxonomía", previsualizar wizard con ella, promocionar a prod.
- RBAC granular (super-admins).
- Versionado semántico de taxonomías con diff visual.

Efectivamente un CMS específico de dominio.

## Mejora tangencial — Registry de tipos de campo (1-2h)

Independiente del admin UI, conviene refactorizar `SubtypeFieldInput` + `buildSubtypeFieldSchema` en un registry:

```ts
// src/config/registries/field-type-registry.ts
export const FIELD_TYPES = {
  boolean:   { render: BooleanInput,  validate: () => z.boolean() },
  enum:      { render: EnumInput,     validate: (f) => z.enum(f.options.map(o=>o.id)) },
  // ...
};
```

Añadir un tipo nuevo = 1 entrada en vez de 3 archivos tocados. Hace el sistema aún más config-driven.

## Decisión actual

**Diferido**. El flujo "editar JSON + PR" es más rápido, seguro y auditable que un admin UI para un equipo técnico. **Trigger para activar este plan**: cuando alguien no-técnico necesite editar taxonomías en producción, o cuando el volumen de cambios de taxonomía supere ~5 PRs/semana.

Cuando llegue ese momento, empezar por el **Nivel 0** (script de lint + impacto) siempre, independientemente del siguiente nivel elegido.
