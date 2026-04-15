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
- Antes de `tsc --noEmit`, ejecutar siempre `prisma generate` — los errores del IDE en modelos/campos Prisma indican caché del servidor TS desactualizada; `generate` regenera `.prisma/client` y `@prisma/client`, resolviendo la discrepancia
- `tsc --noEmit` es la fuente de verdad para TypeScript; los diagnósticos del IDE pueden ser falsos (tipos de Prisma resuelven desde `.prisma/client`, no `@prisma/client`)
- Tras `prisma db push` + `generate`, reiniciar el servidor de desarrollo — el singleton `globalThis.prisma` cachea el cliente antiguo y da `Unknown argument` en runtime aunque la columna exista en la DB
- Verificar columnas reales: `psql "postgresql://javierabrilibanez@localhost:5432/guide_builder" -c "\d nombre_tabla"`
- `git push` a veces falla en silencio (proxy rtk); verificar siempre con `git ls-remote origin <branch>` antes de abrir PR
- `next dev` salta a 3001/3002/3003 si 3000 está ocupado — `lsof -i -P | grep node` confirma el puerto real
- `main` no tiene upstream tracking → usar `git pull origin main` (no `git pull` a secas)
- Cambios de esquema en dev: `prisma db push --accept-data-loss`, no `migrate deploy` (el historial se re-aplica sucio contra una DB ya sincronizada)

## Patrones de Sistemas

- Añadir sección al sidebar = editar también `icon-registry.ts` (SECTION_ICONS) y `renderer-registry.ts` — `config-driven.test.ts` lo verifica y falla si falta
- Nuevos modelos con clave de negocio compuesta: siempre `@@unique([...])`, no solo `@@index` — sin esto se permiten duplicados bajo concurrencia
- Prisma P2002 (unique violation) en `catch`: discriminar con `(err as { code?: string }).code === "P2002"` y re-throw el resto — no swallowear todo
- Server actions que reciben un ID de entidad: guard `if (!id) return { success: false, error: "..." }` + verificar ownership desde DB + derivar `propertyId` de DB para `revalidatePath` (no del cliente)
- Modo `inherited` en tablas de override = DELETE la fila (no upsert con mode="inherited") — mantiene la tabla limpia
- `defaultCoverageRule` en `system_taxonomy.json`: `property_only` → nunca en spaces; `selected_spaces` → solo con `override_yes`; `all_relevant_spaces` → default heredado
- `stripNulls` antes de serializar a JSON: filtrar claves con valor `null` o `""` para no persistir ni contar como "configurados" campos vacíos
- `FormEvent<HTMLFormElement>` (not `React.FormEvent`): importar `type FormEvent` de `"react"` en archivos que no importan el namespace React
- Antes de crear una server action nueva, grep por el nombre de cada export planeado para verificar que no existe ya un consumidor del módulo existente — este repo arrastró un archivo de 125 LOC sin consumidores durante tres branches

## Patrones de UI — Espacios

- Botones de feature activos: estilo sólido `bg-[var(--color-primary-500)] text-white` — **no** `bg-primary-50 text-primary-700` (bajo contraste sobre surface-elevated)
- `SpaceSection`: punto de color + label bold (`text-[var(--color-neutral-600)] font-bold`) para separación visual clara
- Añadir un nuevo `type` a `SpaceFeatureField` requiere cambios en 3 sitios: `src/lib/types/taxonomy.ts` (union), `StructuredField` en `space-card.tsx`, y filtro de `FlatFeatureSection`
- `InfoTooltip` usa `createPortal` a `document.body` con offsets `window.scrollY/X` para escapar `overflow-hidden` de CollapsibleSection — no cambiar esta implementación
- Warning de capacidad de camas: va dentro de `BedManager` justo debajo del label "Capacidad total", no como bloque separado en el card
- `text_chips`: tipo de campo para etiquetas libres (array de strings); estado propio en `TextChipsField`, Enter añade chip
- Datos JSON libres (heating/cooling custom, views custom, bed configJson) no requieren migración — se almacenan en campos `Json?` ya existentes (`featuresJson`, `configJson`)
