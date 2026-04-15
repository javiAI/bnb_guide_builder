# Skills, MCPs y Plugins — Guía Completa

Referencia de todas las extensiones instaladas en Claude Code, cómo usarlas, cuándo invocarlas, seguridad, modelo/esfuerzo recomendado y ejemplos prácticos.

> **Fecha:** 2026-04-12
> **Scope:** Global (disponible en todos los proyectos) salvo indicación contraria

---

## Índice

1. [Plugins globales](#1-plugins-globales)
2. [Skills globales](#2-skills-globales)
3. [MCPs globales](#3-mcps-globales)
4. [No instalados — disponibles por proyecto](#4-no-instalados--disponibles-por-proyecto)
5. [Modelo y esfuerzo recomendado](#5-modelo-y-esfuerzo-recomendado)
6. [Ejemplos prácticos en guide_builder_claude](#6-ejemplos-prácticos-en-guide_builder_claude)
7. [Activación en VSCode](#7-activación-en-vscode)

---

## 1. Plugins globales

### 1.1 CLAUDE.md Management (Anthropic)

| Campo | Valor |
|-------|-------|
| **Tipo** | Plugin oficial Anthropic |
| **Seguridad** | **10/10** — De Anthropic, solo lee/escribe CLAUDE.md |
| **Invocación** | Auto-trigger al mencionar "auditar CLAUDE.md" + Manual: `/revise-claude-md` |
| **Qué hace** | Audita calidad de CLAUDE.md contra el codebase actual (quality score) y captura learnings de la sesión para escribirlos en CLAUDE.md |
| **Modelo recomendado** | **Sonnet** — Es lectura/escritura de markdown, no requiere razonamiento profundo. Opus es overkill |
| **Esfuerzo** | **medium** — Necesita analizar el codebase pero no requiere razonamiento extenso |
| **Cuándo usar** | Al final de sesiones productivas donde descubriste patrones. Periódicamente (1x/semana) para mantener CLAUDE.md al día |
| **Cuándo NO usar** | En cada sesión. Solo cuando hay aprendizajes reales que persistir |

### 1.2 Feature Dev (Anthropic)

| Campo | Valor |
|-------|-------|
| **Tipo** | Plugin oficial Anthropic |
| **Seguridad** | **10/10** — De Anthropic, solo lee/escribe código local |
| **Invocación** | Solo manual: `/feature-dev` |
| **Qué hace** | Workflow de 7 fases: Discovery → Exploración (subagents paralelos) → Preguntas → Arquitectura → Implementación → Review → Summary |
| **Modelo recomendado** | **Opus** — Lanza subagents que necesitan razonamiento profundo para explorar, diseñar y revisar |
| **Esfuerzo** | **high** — Feature completa, requiere análisis extenso |
| **Cuándo usar** | Features que tocan 5+ archivos, requieren decisiones de arquitectura, o son totalmente nuevas |
| **Cuándo NO usar** | Cambios pequeños, fixes, ajustes de UI. Consume 50-200K tokens por invocación |
| **Coste** | Alto — múltiples subagents explorers, architects y reviewers |

---

## 2. Skills globales

### 2.1 Playwright CLI (Microsoft)

| Campo | Valor |
|-------|-------|
| **Tipo** | Skill + CLI tool (`@playwright/cli`) |
| **Seguridad** | **8/10** — Ejecuta browser real (puede visitar URLs, ejecutar JS). De Microsoft, Apache 2.0 |
| **Invocación** | Auto-trigger en contexto testing/browser + Manual: `/playwright-cli` |
| **Qué hace** | Automatización de navegador: navegar, click, screenshots, video, ejecutar JS, testing visual |
| **Modelo recomendado** | **Sonnet** para screenshots/verificación visual. **Opus** si necesitas debugging complejo de UI |
| **Esfuerzo** | **medium** — Ejecutar comandos de browser no requiere razonamiento extenso |
| **Cuándo usar** | Verificar UI funciona correctamente, testing visual, interactuar con web apps, screenshots de estado |
| **Cuándo NO usar** | Solo para "ver" algo — usa el dev server directamente. No para navegar webs externas sensibles |
| **Config de seguridad** | Archivo `.playwright/cli.config.json` — puedes añadir `blockedOrigins` para restringir |

### 2.2 Excalidraw Diagram

| Campo | Valor |
|-------|-------|
| **Tipo** | Skill |
| **Seguridad** | **9/10** — Todo local. Sin licencia explícita (-1) |
| **Invocación** | Auto-trigger al pedir diagramas + Manual: `/excalidraw-diagram` |
| **Qué hace** | Genera diagramas Excalidraw (.excalidraw JSON + render PNG) desde descripción en lenguaje natural |
| **Modelo recomendado** | **Opus** — Generar JSON de diagramas complejos requiere razonamiento espacial avanzado |
| **Esfuerzo** | **high** — Los diagramas con muchos elementos necesitan precisión en coordenadas y relaciones |
| **Cuándo usar** | Visualizar arquitecturas, flujos de datos, workflows, diseños de UI |
| **Cuándo NO usar** | Para diagramas simples (2-3 cajas) — describe en texto directamente |
| **Dependencias** | Python (uv) + Playwright + Chromium para render a PNG. Sin ellos, solo genera el JSON |

### 2.3 Firecrawl (12 skills)

| Campo | Valor |
|-------|-------|
| **Tipo** | Skills (12 skills: scrape, search, crawl, map, download, interact, agent + 4 build + 1 general) |
| **Seguridad** | **7/10** — Envía URLs a API cloud de Firecrawl. Cuidado con URLs privadas/internas |
| **Invocación** | Auto-trigger en contexto de scraping + Manual: `/firecrawl-scrape`, `/firecrawl-search`, `/firecrawl-crawl`, etc. |
| **Qué hace** | Web scraping → markdown LLM-ready. Buscar, extraer, crawlear sitios web |
| **Modelo recomendado** | **Sonnet** para scraping básico. **Opus** si necesitas analizar/sintetizar lo extraído |
| **Esfuerzo** | **low-medium** — El trabajo pesado lo hace la API de Firecrawl |
| **Cuándo usar** | Investigar documentación de librerías, extraer contenido de referencia, buscar información |
| **Cuándo NO usar** | Con URLs internas, privadas o sensibles |
| **Config pendiente** | `firecrawl setup` en terminal para API key. Tier gratis disponible |

**Skills principales:**
| Skill | Uso |
|-------|-----|
| `/firecrawl-scrape` | Extraer contenido de una URL específica |
| `/firecrawl-search` | Buscar en la web |
| `/firecrawl-crawl` | Crawlear un sitio completo |
| `/firecrawl-map` | Mapear estructura de un sitio |
| `/firecrawl-download` | Descargar contenido |
| `/firecrawl-interact` | Interactuar con páginas (formularios, clicks) |

### 2.4 Pre-commit Review (built-in, proyecto)

| Campo | Valor |
|-------|-------|
| **Tipo** | Skill (proyecto — en `.claude/skills/`) |
| **Seguridad** | **10/10** — Solo lee código local |
| **Invocación** | Auto-trigger antes de commits (via hook) + Manual: `/pre-commit-review` |
| **Qué hace** | Revisa código antes de commit: calidad, consistencia, dead code, schema sync, component reuse |
| **Modelo recomendado** | **Sonnet** — Review de código es su punto fuerte, no necesita Opus |
| **Esfuerzo** | **medium** |
| **Cuándo usar** | Siempre antes de commits. Ya configurado como hook automático |

### 2.5 Review PR Comments (built-in)

| Campo | Valor |
|-------|-------|
| **Tipo** | Skill global |
| **Seguridad** | **10/10** — Lee comentarios de PR via gh CLI |
| **Invocación** | Manual: `/review-pr-comments` |
| **Qué hace** | Lee comentarios de PR, clasifica por valor/esfuerzo, recomienda cuáles aplicar, puede auto-fix |
| **Modelo recomendado** | **Sonnet** para triage. **Opus** si quieres auto-fix de los comentarios |
| **Esfuerzo** | **medium** |

### 2.6 Simplify (built-in)

| Campo | Valor |
|-------|-------|
| **Tipo** | Skill built-in |
| **Seguridad** | **10/10** |
| **Invocación** | Manual: `/simplify` |
| **Qué hace** | Revisa código cambiado para reutilización, calidad y eficiencia, y corrige issues |
| **Modelo recomendado** | **Sonnet** |
| **Esfuerzo** | **medium** |

---

## 3. MCPs globales

### 3.1 Context7 (Upstash)

| Campo | Valor |
|-------|-------|
| **Tipo** | MCP Server (`@upstash/context7-mcp`) |
| **Seguridad** | **9/10** — Consulta servicio cloud de Upstash. Solo envía nombres de librerías, no tu código |
| **Invocación** | **Automática** — Claude lo usa cuando necesita docs actualizadas |
| **Qué hace** | Proporciona documentación actualizada de librerías (React, Next.js, Prisma, Tailwind, etc.) directamente en contexto |
| **Modelo recomendado** | No aplica — es una herramienta que cualquier modelo puede usar |
| **Esfuerzo** | No aplica — se activa en background |
| **Coste** | Muy bajo — tool search lo defiere. ~50 tokens en idle, ~200-500 por consulta |
| **Cuándo es útil** | Cuando Claude necesita verificar API de una librería específica o hay dudas sobre sintaxis/features |
| **Config** | Ya configurado en `~/.claude/.mcp.json`. Sin API key necesaria |

---

## 4. No instalados — disponibles por proyecto

### 4.1 Superpowers (obra)

| Campo | Valor |
|-------|-------|
| **Tipo** | Plugin (14 skills + hooks) |
| **Seguridad** | **8/10** — MIT, autor reconocido. -2 por auto-invocación agresiva y subagents autónomos |
| **Estado** | Marketplace configurado, NO activo. Listo para instalar por proyecto |
| **Por qué no global** | Se auto-invoca agresivamente via hooks en CADA sesión. Inyecta instrucciones en `<EXTREMELY_IMPORTANT>` tags. NO detecta workflows existentes. Entraría en conflicto con proyectos que ya tienen CLAUDE.md y workflow propio |
| **Para instalar** | Dentro del proyecto deseado: `/plugin install superpowers@superpowers-marketplace` |
| **Modelo recomendado** | **Opus** — Sus skills de spec, TDD y architecture requieren razonamiento profundo |
| **Esfuerzo** | **high** — Impone un workflow completo (spec → plan → TDD → implement → review) |
| **Cuándo usar** | En proyectos NUEVOS sin workflow definido, donde quieras un proceso estructurado desde cero |
| **Cuándo NO usar** | En proyectos con CLAUDE.md y workflow propio (como guide_builder_claude) |

### 4.2 n8n-MCP + n8n-skills

| Campo | Valor |
|-------|-------|
| **Tipo** | MCP Server + 7 Skills |
| **Seguridad** | **8/10** (MCP) / **10/10** (skills) |
| **Estado** | No instalado |
| **Por qué no instalado** | Solo relevante si usas n8n para automatización |
| **Para instalar** | MCP: añadir a `.claude/.mcp.json` del proyecto. Skills: `npx skills add czlonkowski/n8n-skills` |

---

## 5. Modelo y esfuerzo recomendado — Resumen

| Herramienta | Modelo | Esfuerzo | Justificación |
|-------------|--------|----------|---------------|
| CLAUDE.md Mgmt | **Sonnet** | medium | Lectura/escritura de markdown, no requiere razonamiento profundo |
| Feature Dev | **Opus** | high | Subagents de exploración/arquitectura/review necesitan capacidad máxima |
| Playwright CLI | **Sonnet** / Opus para debug | medium | Ejecutar comandos de browser es mecánico; debugging UI complejo necesita Opus |
| Excalidraw | **Opus** | high | JSON de diagramas complejos requiere razonamiento espacial |
| Firecrawl | **Sonnet** / Opus para síntesis | low-medium | Scraping es mecánico; sintetizar contenido extraído necesita más capacidad |
| Context7 | Cualquiera | N/A | Herramienta passiva que cualquier modelo usa |
| Pre-commit review | **Sonnet** | medium | Code review es su punto fuerte |
| Simplify | **Sonnet** | medium | Refactoring puntual |
| Review PR Comments | **Sonnet** / Opus para autofix | medium | Triage es simple; auto-fix necesita más capacidad |
| Superpowers | **Opus** | high | Workflow completo con múltiples fases y subagents |

### Cuándo cambiar de modelo

- **Usa Sonnet** para: revisiones de código, scraping, commands de browser, tasks mecánicas, mantenimiento de CLAUDE.md
- **Usa Opus** para: features nuevas complejas, diagramas, debugging profundo, síntesis de información, arquitectura
- **Usa Haiku** para: nada de lo anterior — Haiku no soporta tool search y muchas skills requieren capacidades avanzadas

### Cuándo subir esfuerzo

- **low**: Consultas simples, un solo comando, verificación rápida
- **medium**: La mayoría de invocaciones de skills (review, scraping, screenshots)
- **high**: Features nuevas, diagramas complejos, análisis de arquitectura
- **max**: Solo para `/feature-dev` en features críticas o Superpowers en modo completo

---

## 6. Ejemplos prácticos en guide_builder_claude

### 6.1 Feature Dev — Implementar sección Espacios completa

```
/feature-dev Implementar la sección Espacios con formularios config-driven, 
taxonomías por tipo de espacio, persistencia Prisma y coherencia visual 
con Propiedad, Acceso y Contactos
```

**Por qué:** Es una feature compleja que toca taxonomías, componentes React, Prisma schema, config, y múltiples vistas. Feature Dev explorará el codebase (secciones existentes como Propiedad, Contactos, Normas), diseñará la arquitectura y generará una implementación coherente.

### 6.2 Excalidraw — Diagrama de arquitectura de espacios

```
/excalidraw-diagram Diagrama de flujo de datos de la sección Espacios:
- Wizard (camas) → space_types.json + room_types.json → Formulario de espacio
- Cada tipo de espacio tiene campos diferentes (cocina vs baño vs dormitorio)
- Persistencia: Prisma → PostgreSQL
- Config-driven: taxonomías → schemas → registries → componentes React
```

**Por qué:** Visualizar cómo fluyen los datos desde el wizard hasta la sección de espacios ayuda a alinear la implementación antes de escribir código.

### 6.3 Playwright CLI — Verificar UI de secciones existentes

```
/playwright-cli Navega a localhost:3000, toma screenshots de las secciones 
Propiedad, Contactos y Normas para que pueda ver los patrones de UI 
que la sección Espacios debe seguir
```

**Por qué:** Ver visualmente las secciones existentes te permite verificar coherencia visual sin navegar manualmente. Claude puede analizar los screenshots para identificar patrones.

### 6.4 Context7 — Docs actualizadas de Prisma relations

Ejemplo implícito: cuando Claude necesite crear las relaciones de Prisma para Space → SpaceFeature → Property, Context7 automáticamente proporcionará la documentación actual de `@relation`, `@@unique`, etc. en vez de usar conocimiento potencialmente desactualizado.

### 6.5 CLAUDE.md Management — Después de implementar Espacios

```
/revise-claude-md
```

**Por qué:** Después de implementar una sección completa, habrás descubierto patrones nuevos (cómo crear secciones config-driven, qué schemas reutilizar, qué componentes son compartidos). Capturar esto mantiene CLAUDE.md al día.

### 6.6 Firecrawl — Investigar best practices de UX para property management

```
/firecrawl-search "best practices UX property management software spaces rooms configuration"
```

**Por qué:** Antes de diseñar la UX de la sección Espacios, investigar cómo lo hacen apps similares (Guesty, Hospitable, OwnerRez) te da ideas de diseño fundamentadas.

### 6.7 Simplify — Después de implementar

```
/simplify
```

**Por qué:** Después de crear muchos componentes nuevos para Espacios, revisar automáticamente si hay código duplicado, oportunidades de reutilización o simplificaciones.

### 6.8 Pre-commit Review — Antes de cada commit

Se activa automáticamente via hook. Verifica que la nueva sección sigue los patrones del proyecto: config-driven, taxonomías centralizadas, schemas Prisma correctos, componentes reutilizados.

---

## 7. Activación en VSCode

### Arquitectura de instalación

Los componentes se instalan como archivos normales en `~/.claude/` (global) o `.claude/` (proyecto):

| Componente | Ubicación | Efecto |
|------------|-----------|--------|
| **Commands** (`/feature-dev`, `/revise-claude-md`) | `~/.claude/commands/*.md` | Slash commands disponibles en `/` |
| **Agents** (code-explorer, code-architect, code-reviewer) | `~/.claude/agents/*.md` | Subagents que Feature Dev puede invocar |
| **Skills** (claude-md-improver, excalidraw, playwright, firecrawl...) | `~/.claude/skills/*/SKILL.md` | Auto-trigger + invocación manual |
| **MCP** (Context7) | `~/.claude/.mcp.json` | Tools disponibles automáticamente |

> **Nota:** NO se usó el sistema de `/plugin install` sino copia directa de archivos. Esto es equivalente y más fiable para instalación programática.

### Pasos para activar en una sesión nueva

**1. Abrir nueva sesión de Claude Code:**
Las skills/commands/agents se cargan al inicio de sesión. Para activarlos:
- En VSCode: `Cmd+Shift+P` → "Claude Code: New Session" o cierra y abre el panel
- En terminal: sal de `claude` y vuelve a entrar

**2. Verificar slash commands:**
Escribe `/` en el input de Claude Code. Deberías ver en el autocompletado:
- `/feature-dev` — Workflow de desarrollo de features
- `/revise-claude-md` — Capturar learnings en CLAUDE.md
- `/playwright-cli` — Automatización de browser
- `/excalidraw-diagram` — Generar diagramas
- `/firecrawl-scrape`, `/firecrawl-search`, etc. — Web scraping
- `/simplify` — Simplificar código
- `/review-pr-comments` — Revisar comentarios de PR
- `/pre-commit-review` — Review pre-commit

**3. Verificar MCP:**
```
/mcp
```
Deberías ver `context7` listado. Se conectará lazy al primer uso.

**4. Configurar Firecrawl API key (una sola vez):**
En una terminal (no en Claude Code):
```bash
firecrawl setup
```
Sigue las instrucciones para autenticarte. Hay tier gratis.

**5. Para otros repositorios:**
Todo lo instalado en `~/.claude/` está disponible automáticamente en cualquier proyecto. Solo necesitas abrir una nueva sesión.

### Verificación rápida

En una nueva sesión, prueba:
```
Audita mi CLAUDE.md y dime si está al día con el codebase
```
Si claude-md-improver está funcionando, debería activarse automáticamente.

---

## 8. Automatización via Hooks

Los hooks de Claude Code inyectan contexto inteligente en cada interacción. No invocan skills directamente (limitación del sistema), pero Claude recibe las sugerencias y actúa en consecuencia.

### Hooks configurados (`.claude/settings.local.json`)

| Hook Event | Script | Qué detecta | Qué sugiere |
|------------|--------|-------------|-------------|
| `UserPromptSubmit` | `smart-context.sh` | PR con comments, merge reciente en main, feature compleja, muchos cambios sin commit | `/review-pr-comments`, `/simplify`, `/feature-dev`, `/pre-commit-review` |
| `PreToolUse` (Bash) | inline echo | `git commit` a punto de ejecutarse | `/pre-commit-review` |
| `PostToolUse` (Bash) | `post-action.sh` | `gh pr merge`, `git merge`, `git push`, `git checkout -b feat/` | `/simplify`, `/revise-claude-md`, `/playwright-cli`, `/review-pr-comments`, `/feature-dev` |
| `Stop` | `stop-reminder.sh` | Sesión productiva (3+ commits o 5+ archivos cambiados) cada 20 respuestas | `/revise-claude-md`, `/playwright-cli` |

### Flujo automático por escenario

**Inicio de sesión en rama feature con PR abierto:**
```
[UserPromptSubmit] → "PR #N has review comments. Run /review-pr-comments"
```

**Inicio de sesión en main después de merge:**
```
[UserPromptSubmit] → "Recent merge detected. Consider /simplify"
```

**Usuario pide implementar feature compleja:**
```
[UserPromptSubmit] → "Complex feature detected. Consider /feature-dev"
```

**Se crea rama feat/:**
```
[PostToolUse] → "New feature branch. Consider /feature-dev"
```

**Se hace git push a rama con PR:**
```
[PostToolUse] → "Pushed to PR #N. Run /review-pr-comments after Copilot reviews"
```

**Se mergea PR:**
```
[PostToolUse] → "PR merged. Run /simplify, /revise-claude-md, /playwright-cli"
```

**Antes de git commit:**
```
[PreToolUse] → "Run /pre-commit-review first"
```

**Sesión larga con muchos cambios (cada 20 respuestas):**
```
[Stop] → "Productive session. Run /revise-claude-md and /playwright-cli"
```

### Limitaciones

- Los hooks son **advisory**: inyectan contexto que Claude sigue, pero no es ejecución garantizada
- Cada hook usa **state files** en `/tmp/claude-hooks-{sessionId}/` para no repetir sugerencias
- `SessionEnd` es read-only — no se puede inyectar contexto al cerrar sesión
- Los hooks deben ser rápidos (<10s timeout); `gh api` calls pueden ser lentos en redes malas

### Archivos

```
.claude/hooks/
├── smart-context.sh     # UserPromptSubmit: detecta estado del proyecto
├── post-action.sh       # PostToolUse: detecta merges, pushes, branches
└── stop-reminder.sh     # Stop: recuerda /revise-claude-md en sesiones largas
```

---

## Notas de seguridad generales

- **Nunca uses Firecrawl con URLs internas/privadas** — el contenido pasa por servidores de Firecrawl
- **Playwright ejecuta un browser real** — puede interactuar con cualquier web. Usa `blockedOrigins` en config si necesitas restringir
- **Context7 solo envía nombres de librerías** — no tu código
- **Todos los plugins oficiales de Anthropic son auditados** — máxima confianza
- **Superpowers es seguro pero agresivo** — solo instalar donde no haya workflow propio
