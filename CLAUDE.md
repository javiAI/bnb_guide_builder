# CLAUDE.md

Implementa exactamente el paquete `version_3`.

## Orden de lectura

1. `README.md`
2. `AGENTS.md`
3. `docs/MASTER_IMPLEMENTATION_SPEC.md`
4. `docs/IMPLEMENTATION_PLAN.md`
5. `docs/REPOSITORY_APPLICATION_GUIDE.md`
6. `docs/SYSTEM_ARCHITECTURE.md`
7. `docs/DATA_MODEL_AND_PERSISTENCE.md`
8. `docs/API_CONTRACTS.md`
9. `docs/SECURITY_VISIBILITY_AND_AUDIT.md`
10. `docs/QA_EVALS_AND_RELEASE.md`
11. `docs/CONFIG_DRIVEN_ARCHITECTURE.md`
12. `taxonomies/*.json`
13. `skills/orchestrator/SKILL.md`
14. skill de la fase activa
15. prompt de la fase activa

## Reglas

- no improvisar producto fuera de la spec
- elegir siempre el criterio reconciliado de `version_3`
- labels visibles: español
- IDs, código, nombres internos y enums: inglés
- sistema métrico
- secretos segregados y auditados
- no mezclar guest, AI, internal y sensitive
- no saltar de fase sin validación explícita
- arquitectura config-driven: taxonomías, campos, dependencias, media y renderizado viven en configuración centralizada (`src/config/` y `taxonomies/`), no hardcodeados en componentes React
- añadir amenity, policy, access method o sección = editar config/taxonomía, no tocar UI

## Entorno y comandos

- `npx` falla en sandbox de tools — usar siempre `/Users/javierabrilibanez/.nvm/versions/node/v18.20.5/bin/npx`
- `tsc --noEmit` es la fuente de verdad para TypeScript; los diagnósticos del IDE pueden ser falsos (tipos de Prisma resuelven desde `.prisma/client`, no `@prisma/client`)
- Tras `prisma db push` + `generate`, reiniciar el servidor de desarrollo — el singleton `globalThis.prisma` cachea el cliente antiguo y da `Unknown argument` en runtime aunque la columna exista en la DB
- Verificar columnas reales: `psql "postgresql://javierabrilibanez@localhost:5432/guide_builder" -c "\d nombre_tabla"`

## Patrones de UI — Espacios

- Botones de feature activos: estilo sólido `bg-[var(--color-primary-500)] text-white` — **no** `bg-primary-50 text-primary-700` (bajo contraste sobre surface-elevated)
- `SpaceSection`: punto de color + label bold (`text-[var(--color-neutral-600)] font-bold`) para separación visual clara
- Añadir un nuevo `type` a `SpaceFeatureField` requiere cambios en 3 sitios: `src/lib/types/taxonomy.ts` (union), `StructuredField` en `space-card.tsx`, y filtro de `FlatFeatureSection`
- `InfoTooltip` usa `createPortal` a `document.body` con offsets `window.scrollY/X` para escapar `overflow-hidden` de CollapsibleSection — no cambiar esta implementación
- Warning de capacidad de camas: va dentro de `BedManager` justo debajo del label "Capacidad total", no como bloque separado en el card
- `text_chips`: tipo de campo para etiquetas libres (array de strings); estado propio en `TextChipsField`, Enter añade chip
- Datos JSON libres (heating/cooling custom, views custom, bed configJson) no requieren migración — se almacenan en campos `Json?` ya existentes (`featuresJson`, `configJson`)
