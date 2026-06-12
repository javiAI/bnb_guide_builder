# HANDOFF — Quickref para arrancar una sesión con eficiencia

> Doc operativo pensado para sesión nueva (o retomar tras `/clear`). Objetivo: llegar a "puedo ejecutar la Fase -1 de la siguiente rama" con el mínimo ruido de contexto.

---

## 1. Snapshot en 30 segundos

- Fuente de verdad ejecutable: [MASTER_PLAN_V2.md](MASTER_PLAN_V2.md). Estado: Fases 8–15 ✅ cerradas. Fase 16 (Liora, 8 ramas 16A–16H + sub-ramas) **en ejecución avanzada**: 16A–16D, 16D.5, 16E.5 (todos los módulos de contenido), 16E.6, 16F.5 (#116), 16F.6 (#118) merged. **Siguiente: Fase 16I — pulido de contenido** (10 ramas, una por pestaña, secuenciales, aprobación por PR; ver `MASTER_PLAN_V2.md § FASE 16I`). Pendientes posteriores: 16F assistant `/ai`, 16G legacy, 16H guest. Única rama **funcional** del plan original sin cerrar: **13C `feat/guide-maps-embedded`**. Reglas anti-legacy: `docs/ARCHITECTURE_OVERVIEW.md` §14.
- Estado vivo: [ROADMAP.md](ROADMAP.md) (tabla + "Progreso Fase X" por rama).
- Research base congelado v1.0 (referenciar por línea, no copiar):
  - [research/GUEST_GUIDE_SPEC.md](research/GUEST_GUIDE_SPEC.md)
  - [research/AI_KNOWLEDGE_BASE_SPEC.md](research/AI_KNOWLEDGE_BASE_SPEC.md)
  - [research/IMPLEMENTATION_PLAN.md](research/IMPLEMENTATION_PLAN.md)
  - [research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md) — origen de rev.4 del pipeline guest (Fase 10 cerrada).
- Diferido (no confundir con roadmap): [FUTURE.md](FUTURE.md).

---

## 2. Verificación de estado en una línea

```bash
git fetch origin main --quiet && git log origin/main --oneline -10 && git status -sb
```

Con esto ves: últimos merges (para saber qué rama está hecha), branch actual, archivos sin commitear. Si la última línea del log no coincide con "Progreso Fase X" del ROADMAP, el roadmap está desactualizado — actualizarlo antes de empezar.

---

## 3. Decisión `/compact` vs `/clear` vs sesión nueva

| Caso | Acción |
|---|---|
| Código de la rama anterior mergeado, docs actualizados, MEMORY.md refleja progreso | **`/clear`** (default) |
| Acabamos de hacer Fase -1 de la siguiente rama en esta misma conversación sin persistir aún | **`/compact` con keep_recent_messages=50** + guardar decisiones Fase -1 como memoria `project` antes |
| Sesión muy larga con decisiones intermedias (providers, schema) aún sin grabar en docs/memoria | **`/compact` con focus explícito** en "decisiones pendientes de grabar" + crear memorias `project` justo después |
| Cambio de rama ortogonal (ej. pasar de 10D a 12A tras un desvío) | **Sesión nueva** (terminal limpio), carga MEMORY.md + CLAUDE.md automático |

Regla dura: si hay contexto crítico que no está en git + docs + MEMORY.md, **no uses `/clear`** — persiste primero.

---

## 4. Orden óptimo de lectura al arrancar una rama

1. Leer **este doc** (HANDOFF.md) — el snapshot.
2. `MEMORY.md` se carga solo — revisa entradas `project` para ver qué está in-flight.
3. **Sección entera de la rama** en `MASTER_PLAN_V2.md` (desde "### Rama XY" hasta el siguiente `---`).
4. **"Contexto a leer"** de esa sección — lee solo esos archivos/rangos.
5. Si la rama referencia research con `L:xx-yy`, lee esos rangos concretos, NO el archivo entero.
6. Ejecutar `§2.1 Fase -1` del plan (gate de aprobación).

Anti-patrón: leer `MASTER_PLAN_V2.md` entero (>1400 líneas). Desperdicia contexto.

---

## 5. Template de prompt de continuación post-merge

```text
Continúa con docs/MASTER_PLAN_V2.md.
Acabamos de mergear: ✅ [rama] (PR #N).
Siguiente rama: XY `nombre-rama`.
[Instrucción de contexto — ver §3 de HANDOFF.md]
Lee solo:
  - docs/MASTER_PLAN_V2.md § Rama XY (entera)
  - Los rangos de research citados en "Contexto a leer" de esa rama
  - Los archivos del repo citados (no más)
Ejecuta §2.1 Fase -1 completo: resumen técnico + conceptual + ambigüedades + alternativas. Espera aprobación explícita antes de crear la rama.
```

---

## 6. Pre-flight checklist (antes de escribir código)

- [ ] `git pull origin main --ff-only` (main no tiene tracking, siempre explícito)
- [ ] `npx prisma generate` antes de cualquier `tsc --noEmit` (IDE da falsos positivos si se salta)
- [ ] `.env` tiene las vars que la rama necesita (ver "Entorno y comandos" en CLAUDE.md)
- [ ] Servidor dev reiniciado si hubo `prisma db push` reciente (singleton cacheado)
- [ ] Fase -1 aprobada explícitamente por el usuario
- [ ] Marker de approval: `.claude/branch-approvals/<branch-slug>.approved` existe
- [ ] `git checkout -b <branch-name>` tras crear el marker (hook lo exige)

---

## 7. Gotchas del entorno (resumen de CLAUDE.md)

- `npx` del sandbox rompe — usar `/Users/javierabrilibanez/.nvm/versions/node/v18.20.5/bin/npx`.
- `tsc --noEmit` es la fuente de verdad TypeScript; el IDE miente con tipos de Prisma.
- `git push` a veces falla silente (proxy rtk) — verificar con `git ls-remote origin <branch>`.
- `next dev` salta a 3001/3002 si 3000 ocupado — `lsof -i -P | grep node` para ver el real.
- Schema change en dev: `prisma db push --accept-data-loss`, no `migrate deploy`.
- Media: requiere `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` en `.env`.
- Postgres local: `psql "postgresql://javierabrilibanez@localhost:5432/guide_builder"` para inspeccionar.

---

## 8. Skills / MCPs por default

Siempre disponibles, se invocan on-demand:

| Cuándo | Tool |
|---|---|
| Antes de commit | `/pre-commit-review` (hook lo recuerda) |
| Cambio volumen significativo antes de PR | `/simplify` |
| Tras review de Copilot | `/review-pr-comments` (per_page=100) |
| Post-merge si nuevos patrones | `/revise-claude-md` |
| Búsqueda external UX/tech | `/firecrawl-search "..."` |
| Diseño visual previo | `/excalidraw-diagram` |
| UI visual en localhost | `/playwright-cli` |
| Ejecución de rama | skill de la rama si existe (`/feature-dev`, etc.) |

Subagentes: `Explore` (búsqueda cross-archivo >3 queries), `code-explorer` (trazar flujos), `code-architect` (diseñar subsistemas), `Plan` (decisiones arquitectónicas).

Context7 (MCP) se activa auto — no invocar explícitamente salvo que falle.

**Skills `/liora-*` y docs `docs/LIORA_*.md`**: **no creados todavía**. Se crean en 16A/B/C según corresponda. Ver `docs/MASTER_PLAN_V2.md` § FASE 16. Antes de arrancar cualquier rama Liora, leer `design-system/docs/DESIGN_MIGRATION.md` (legacy → semantic mapping + per-branch gates).

---

## 9. Research index — qué hay en cada archivo

| Archivo | Qué contiene | Citar para |
|---|---|---|
| `research/GUEST_GUIDE_SPEC.md` | Journey map (L5-31), IA sections (L33-81), visibility + security (L82-102), UX patterns (L104-160), design tokens (L162-210), interactividad (L211-234), métricas (L236-262) | Fase 10 (especialmente 10E/F/G/H), Fase 13D |
| `research/AI_KNOWLEDGE_BASE_SPEC.md` | Casos de uso (L7-37), AI schema (L40-139), chunk fields (L141-147), chunking (L149-192), contextual retrieval (L194-206), flujo retrieval (L208-215), qué IA necesita (L217-235), prompts (L237-368), campos modelo (L370-425) | Fase 11 completa |
| `research/IMPLEMENTATION_PLAN.md` | Benchmark (L5-25), stack front (L29-49), back + RAG (L51-66), caching (L68-106), roadmap table (L109-127), decisiones críticas (L129-169), no-implementar (L171-183) | Fase 10D (media proxy), 10H (PWA), 11C (retrieval stack) |

Regla: cita con `[FILE.md:Lxx-Lyy](research/FILE.md#Lxx-Lyy)`. Nunca copies el contenido al plan — el research está congelado v1.0 en el repo y es referenciable por línea.

---

## 10. Próxima rama (mantener actualizado al hacer merge)

**Estado (2026-06-02)**: Fase 16 (Liora) en ejecución avanzada — 16A–16D, 16D.5, 16E.5 (todos los módulos de contenido), 16E.6, 16F.5 (#116), 16F.6 (#118) merged. El § Rama 16E monolítico quedó superado (ver su nota de reconciliación en `MASTER_PLAN_V2.md`).

**Estado 16I (2026-06-12)**: 16I-1 ✅ #120 · 16I-2 ✅ #122 (+#121) · 16I-3 diferida · **16I-4 ✅ PR abierta (sin merge)**. **Siguiente: consolidación 16I-5…10** — las 6 pestañas restantes (Sistemas · Equipamiento · Guía local · Soluciones · Normas · Contactos) se estandarizan en UNA sesión orquestada con PRs apiladas (plan en `~/.claude/plans/vamos-a-hacer-un-nifty-perlis.md`; requiere PR previa `chore/plan-update-16I-consolidation`). Modelo original (una rama por pestaña): Spec en `MASTER_PLAN_V2.md § FASE 16I`. Modelo: **una rama por pestaña, secuenciales, con aprobación del usuario por PR** (no paralelizables — comparten `parity-allowlist.ts` + primitivos). Orden = nav: Resumen → Propiedad → Acceso → Espacios → Sistemas → Equipamiento → **Guía local** → **Soluciones** → Normas → Contactos. Las 8 primeras + 2 últimas son refinamiento sobre paridad ya lograda; **Guía local** (#7) y **Soluciones** (#8) son trabajo real (port + audit que nunca tuvieron). Alcance = visual/UX/estandarización + cambios **menores** de taxonomía/DB permitidos (excepción documentada, mini Fase -1 si toca schema).

**Lectura mínima para arrancar la primera rama 16I**:

- [MASTER_PLAN_V2.md § FASE 16I](MASTER_PLAN_V2.md) — fase entera + tabla de ramas + contrato/gate común.
- [docs/LIORA_SURFACE_ROLLOUT_PLAN.md § 16I](LIORA_SURFACE_ROLLOUT_PLAN.md) — estado por pestaña.
- `CLAUDE.md` § "Patrones de UI — Operator shell" + § "Primitivos obligatorios (Fase 16D.5)" + § "Allowlist governance".
- `src/test/parity-allowlist.ts` (`AUDITED_SURFACES`, `CURRENT_LIORA_PHASE`, `LioraPhase`) + `src/test/component-invariants.test.ts`.
- El kit de la pestaña: `design-system/references/liora-ui-kits/ui_kits/operator/subpages.html` (mapping versionado en `design-system/docs/LIORA_REFERENCE_MAPPING.md`).
- `design-system/docs/DESIGN_MIGRATION.md` (legacy → semantic + per-branch gates).

**Otra rama abierta (independiente de Liora, decisión de producto cuándo)**: **13C `feat/guide-maps-embedded`** — única rama **funcional** del plan original sin cerrar. Reusa `buildGuideMapData` + `obfuscateAnchor` de 13B + surface de 10F. Se hará sobre los primitivos Liora ya existentes.

Tras merge de cada rama: actualizar este apartado + marcar la rama en ROADMAP.md.
