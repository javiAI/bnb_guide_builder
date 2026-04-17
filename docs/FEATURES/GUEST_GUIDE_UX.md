# GUEST_GUIDE_UX — Reglas duras ejecutables

**Objetivo**: que `/g/:slug` supere en comodidad operativa a Touch Stay, Hostfully Boost, Enso Connect, Breezeway Guides y la guidebook nativa de Airbnb **en el móvil del huésped, con batería al 14%, datos lentos, una mano libre, y atención dispersa**.

Este documento NO describe features. Describe **reglas ejecutables**, aceptables y rechazables. Se usa como:

- fuente de verdad al implementar 10G/10H/10I y refactors futuros del renderer;
- checklist en `/pre-commit-review` y en cada PR que toque `src/components/public-guide/`;
- rúbrica de Playwright + axe-core gates antes de abrir PR.

Consume la frontera garantizada por [10F `fix/guest-presentation-layer`](../MASTER_PLAN_V2.md#fase-10--media-presentation-layer-y-guest-ux-premium): `displayValue`, `displayFields`, `heroEligible`, `quickActionEligible`, `guestCriticality`, `emptyCopyGuest`. No duplicar lógica de presentación en componentes — siempre venir del presenter.

---

## 1. Principios rectores

1. **Cada pantalla sirve una tarea del huésped** (llegar, entrar, saber las normas críticas, pedir ayuda, salir). Nada vive en la guía si no apoya una tarea concreta identificada en el journey.
2. **Partial attention, one-hand, mobile-first**. Si un elemento no se opera con pulgar derecho sobre iPhone 13 mini (375 px) en <2 toques, se rediseña.
3. **Lectura scaneable >> lectura lineal**. El huésped no lee párrafos. Título → bullet → acción.
4. **Jerarquía visual antes que decoración**. Grande/pequeño, sólido/outline, acento/neutral. Si dos cards miden lo mismo en la misma columna, una de las dos está mal clasificada.
5. **Acciones antes que información**. Dónde dé igual, un botón operativo gana a un párrafo explicativo.
6. **Cero fricción en lo crítico**. Wi-Fi copiable en 1 toque, llamar en 1 toque, abrir en Maps en 1 toque. "Copy" con feedback toast a11y.
7. **Offline no degrada la confianza**. Shell + hero + esenciales siempre disponibles; lo no-cacheable se marca con microcopy honesto, no con espacio en blanco.
8. **Silencio cuando no hay dato**. Antes de mostrar copy editorial del host al huésped, ocultar la sección (`hideWhenEmptyForGuest`) o mostrar un empty state neutro.

---

## 2. Jerarquía de contenido

Tres niveles. No hay cuarto.

| Nivel | Qué vive aquí | Tratamiento visual | Cuándo |
|---|---|---|---|
| **L1 — Hero operativo** | Las 4 respuestas críticas del huésped a la hora de llegar: *¿cómo entro? / ¿dónde aparco? / ¿cuál es el Wi-Fi? / ¿a quién llamo si algo pasa?* | Bloque acentuado, `HeroCard`, arriba del pliegue (<640 px de alto en mobile), fondo sólido con token `--color-primary-500` o equivalente por brand | Siempre — incluso si una respuesta falta, el hueco se marca explícitamente (nunca copy editorial del host) |
| **L2 — Esenciales** | Normas críticas (no fumar, ruido, mascotas), check-out, contactos de emergencia | `EssentialCard` — outline acentuado, icono grande, 1–2 líneas máx | Solo items con `guestCriticality === "critical"` (taxonomía 10F) |
| **L3 — Contenido de referencia** | Espacios, amenities, cómo usar electrodomésticos, guía local, información de la propiedad | `StandardCard` — neutro, colapsable, denso | Siempre accesible por scroll o via TOC |

Regla dura: si tres cards consecutivas se ven iguales en la misma columna, la jerarquía está rota — revisar clasificación.

---

## 3. Sistema de cards

Cuatro variantes. Definidas con `class-variance-authority` (CVA) en `src/components/public-guide/ui/card.tsx`. Ninguna otra variante puede añadirse sin actualizar esta tabla.

| Variante | Rol | Estilo obligatorio |
|---|---|---|
| `HeroCard` | L1. 1 por página máx. | Fondo sólido acentuado, título 28 px bold, quick-actions en fila de 2×2, min-height 280 px en mobile |
| `EssentialCard` | L2 — un fact crítico | Borde 2 px acentuado, fondo neutro, icono 24 px, radius 12 px, padding 16 px |
| `StandardCard` | L3 — contenido de referencia | Fondo `--surface-elevated`, radius 12 px, padding 16 px, sombra `elevation-1`, colapsable si `> 4 campos` |
| `WarningCard` | Avisos (outage, host offline, sección incompleta) | Fondo `--color-warning-50`, borde `--color-warning-500`, icono triangular, texto `--color-warning-900` |

**Anti-pattern**: no se usa `StandardCard` para cosas críticas "porque ya existe el componente". Si es crítico, es `EssentialCard`.

---

## 4. Tipografía + escala

Font: **Inter** (variable) con subset latin-ext. Cargada via `next/font/google` con `display: "swap"` — cache offline para PWA (10I).

| Rol | Tamaño | Line-height | Peso | Uso |
|---|---:|---:|---:|---|
| Display | 28 | 32 | 700 | Título del hero, título de la propiedad |
| H1 de sección | 20 | 26 | 600 | Encabezados de nivel sección (Arrival, Spaces...) |
| H2 de card | 16 | 22 | 600 | Título de card |
| Body | 16 mobile / 14 desktop | 24 mobile / 20 desktop | 400 | Texto corrido |
| Micro | 12 | 16 | 500 | Metadatos, leyendas, timestamps |

**Regla ejecutable**: en viewport mobile (`<768px`), `Body` nunca baja de **16 px** (mobile-first + legibilidad con luz ambiental / manos sucias, consistente con la auditoría). En desktop (`≥1024px`) puede compactarse a **14 px** para ritmo vertical denso. El breakpoint tablet hereda de mobile (16 px).

Escalas prohibidas: 10, 11, 13, 15, 17, 18, 22, 24, 26. Si un diseño pide un tamaño intermedio, fuerza a elegir uno del set.

Nunca más de 2 pesos en la misma card. Nunca ALL CAPS salvo en pills acentuados ≤10 caracteres.

---

## 5. Espaciado + ritmo vertical

Escala: `4 · 8 · 12 · 16 · 24 · 32 · 48` px. Nada fuera de esta escala.

| Contexto | Espaciado |
|---|---|
| Entre párrafos de texto dentro de una card | 8 |
| Entre un título y su body | 12 |
| Entre dos campos (label+value) dentro de una card | 16 |
| Entre dos cards consecutivas | 16 |
| Entre dos secciones (L3 → L3) | 32 |
| Entre hero y primera sección | 24 |
| Padding lateral en mobile (<640) | 16 |
| Padding lateral en tablet (640–1024) | 24 |
| Padding lateral en desktop (>1024) | max(40, calc((100vw - 720px) / 2)) — contenido capado a 720 px |

Regla dura: el contenido **no pasa de 720 px** en desktop. Ancho óptimo de lectura para body 14/20.

---

## 6. Color + contraste

Tokens en `src/app/globals.css`. Gama: neutrales + acento brand (curated en `src/config/brand-palette.ts`). Contraste obligatorio **AA (4.5:1)** para body, **AAA (7:1)** para H1/Display.

| Uso | Contraste mínimo |
|---|---|
| Body sobre surface-elevated | 4.5:1 |
| Título sobre surface-elevated | 7:1 |
| Texto sobre hero (fondo acentuado) | 7:1 — usar `--color-primary-50` o blanco puro; **nunca** texto oscuro sobre fondo acentuado medio |
| Pill/Badge | 4.5:1 con su fondo |
| Iconos decorativos | no aplica |
| Iconos informativos (estado, warning, emergency) | 3:1 con su fondo |

Ningún valor cromático hardcoded en componentes — siempre `var(--...)`. `--color-primary-500` puede cambiar por brand sin tocar código.

Modo claro es default. Modo oscuro queda **fuera** de 10F/G/H/I (ver FUTURE.md).

---

## 7. Sombras, bordes, radios

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 8 | Pills, badges, chips |
| `radius-md` | 10 | Inputs, search bar, buttons |
| `radius-lg` | 12 | Cards de cualquier variante |
| `radius-xl` | 20 | Hero, bottom-sheets |
| `radius-full` | 9999 | Avatares, quick-action circle buttons |
| `elevation-0` | none | Cards tomadas desde fondo |
| `elevation-1` | `0 1px 2px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.04)` | StandardCard |
| `elevation-2` | `0 4px 8px rgba(0,0,0,.06), 0 8px 16px rgba(0,0,0,.04)` | HeroCard, bottom-sheet, modal |

Los chips de pill **no** llevan sombra. HeroCard sí. `EssentialCard` puede ir sin sombra si el borde acentuado ya comunica rol.

---

## 8. Media — fotos y vídeo

- Ratios obligatorios: `16:10` para hero, `4:3` para galerías, `1:1` para miniaturas de amenity.
- **Fachada / acceso / parking / hero**: `object-fit: cover`, `aspect-ratio: 16/10`, ancho 100% de la card.
- Lazy por defecto (`loading="lazy"`) excepto hero (`fetchPriority="high"`).
- `blurhash` (ya presente desde 10A) como placeholder en cada foto — sin spinners.
- Galería completa: abrir en `yet-another-react-lightbox` (dynamic import — no bloquea first paint).
- **Vídeo solo donde reduce fricción** (ej: "cómo abrir la cerradura", "cómo usar la inducción"). Nunca vídeo decorativo. Máx 20 s. Sin auto-play. Poster + play button explícito. `preload="metadata"`.
- Subtítulos obligatorios para cualquier vídeo con voz.
- `alt` text presente siempre; vacío (`alt=""`) para decorativo, descriptivo para informativo. Nunca `alt="image"` ni auto-generado.
- Variantes `thumb/md/full` ya vienen del pipeline (10C); el renderer usa `md` inline y `full` en lightbox — **nunca** muestra una imagen a tamaño full fuera del lightbox.

---

## 9. TOC + búsqueda

- TOC sticky en desktop (≥1024); hamburger + drawer en mobile.
- Secciones vacías con `hideWhenEmptyForGuest: true` se excluyen del TOC — el huésped no ve "Normas (vacío)".
- Shortcut `/` abre búsqueda (10H) — focus en input, cierre con `Escape`, `Enter` navega al primer hit.
- Search bar siempre visible en el header sticky en tablet/desktop (≥640). En mobile vive a 1 toque detrás del icono en el app-bar.
- Placeholder: `"Busca: wifi, parking, checkout..."` (nunca genérico "Buscar…").
- 0 resultados: hint con 3 sugerencias (`wifi`, `parking`, `checkout`) + link al bloque esenciales. No mostrar error.

---

## 10. Empty states

Regla dura: **copy editorial pensada para host jamás se muestra al huésped**.

| Caso | Guest ve | Internal ve |
|---|---|---|
| Sección sin items + `hideWhenEmptyForGuest: true` | Sección oculta, no aparece en TOC | Sección con `emptyCopy` editorial + CTA deep-link al host panel |
| Sección sin items + `emptyCopyGuest` declarado | `emptyCopyGuest` como mensaje neutro ("Esta información se actualizará antes de tu llegada.") | `emptyCopy` editorial ("Añade las normas...") + CTA |
| Sección sin items, sin `emptyCopyGuest`, `hideWhenEmptyForGuest: false` | Empty state neutro genérico (un ícono + "—" o "Sin información todavía.") | `emptyCopy` + CTA |

**Ejemplos OK (guest)**:
- "Esta sección se actualizará antes de tu llegada."
- "Consulta con tu anfitrión si necesitas más detalle."
- "—"

**Ejemplos KO (guest)**:
- ❌ "Añade las normas de la casa..."
- ❌ "Aún no has configurado..."
- ❌ "Completa este campo..."
- ❌ JSON crudo, enum `rm.x`, clave técnica.

---

## 11. Responsive — breakpoints

| Breakpoint | Ancho | Layout |
|---|---|---|
| `xs` | <640 | 1 columna, hero full-bleed, TOC en drawer |
| `sm` | 640–767 | 1 columna con más padding lateral; search en header |
| `md` | 768–1023 | 1 columna centrada capada a 680; TOC sticky en lateral derecho si hay altura |
| `lg` | 1024–1279 | 1 columna 720 + TOC sticky izquierda |
| `xl` | ≥1280 | 1 columna 720 + TOC + galería lightbox a pantalla completa |

Tests Playwright obligatorios: `375 × 667`, `768 × 1024`, `1280 × 800`.

Regla dura: hero **siempre** visible arriba del pliegue en los 3 viewports anteriores. Si no cabe, se reduce media, no jerarquía.

---

## 12. Microinteracciones

- **Copy Wi-Fi** → `navigator.clipboard.writeText()` + Toast "Wi-Fi copiado" con `role="status"` y auto-dismiss a 2 s. `Escape` cierra.
- **Llamar host** → `tel:` URI universal. No abrir dialer en iframe ni modal.
- **WhatsApp host** → `https://wa.me/{E.164}?text={prefill}`. `prefill` siempre incluye la dirección corta del apartamento.
- **Abrir en Maps** → `maps://?q=lat,lng` + fallback `https://maps.google.com/?q=lat,lng` con detección `ontouchend && /iPad|iPhone/.test(navigator.userAgent)`.
- **Colapsar card** → animación 180 ms `ease-out`, `prefers-reduced-motion` deshabilita.
- **Lightbox open** → 220 ms fade-in, sin zoom-bounce.
- **Toasts** se apilan de abajo a arriba, máximo 3 simultáneos, el más antiguo se autodismisa.

Anti-pattern: microinteracciones "cool" (spring, overshoot, parallax) que añaden latencia percibida. Fuera.

---

## 13. Accesibilidad — AA no negociable

- Contraste (ver §6).
- Targets táctiles **mínimo 44 × 44 px** con padding 12. Chips pueden ser menores si no son interactivos.
- `:focus-visible` con anillo 2 px `--color-focus` (sólido, no outline). Siempre visible en teclado.
- Orden de tab lógico (hero → cards → footer). Skip-link al contenido principal.
- `aria-label` en botones de icono (`copy`, `call`, `whatsapp`, `maps`). Nunca botón sin texto ni `aria-label`.
- Toast con `role="status"` (no `role="alert"` salvo emergencia).
- Modales/drawers con focus trap (Radix Dialog/Drawer se encarga). `Escape` cierra.
- Imágenes informativas con `alt` descriptivo; decorativas con `alt=""`.
- Subtítulos para todo vídeo con voz.
- `prefers-reduced-motion: reduce` desactiva animaciones no esenciales.
- Testing: `axe-core` integrado en Playwright; **0 violations de severidad serious/critical** como gate de PR.

---

## 14. Benchmarks — qué copiar, qué NO copiar

| Producto | Qué copiar | Qué NO copiar |
|---|---|---|
| **Touch Stay** | Jerarquía clara hero → sections; search visible; modo offline sólido | Navegación tabbed pesada; estética corporativa genérica |
| **Hostfully Boost** | Quick actions arriba; contactos con botón directo | Sobredecoración de portadas; muchas fotos decorativas sin info |
| **Enso Connect** | Upsells contextuales colocados donde suman, no invadiendo crítico | Chat siempre visible (distrae del flujo operativo) |
| **Breezeway Guides** | Runbooks técnicos claros para amenities | Densidad tipo manual de PM — demasiado texto para huésped |
| **Airbnb Guidebook** | Amplio mobile-first; mapas integrados | Falta de jerarquía (todo se lee igual); textos muy largos |

Este bench se revalida cada 6 meses con `/firecrawl-search` antes de refactorizar UX.

---

## 15. Anti-patterns (rechazo automático en code review)

- **Landing-page-style hero decorativo** (gran foto + tagline del host). Hero es operativo, no marketing.
- **Cards homogéneas** (todo `StandardCard`) — rompe jerarquía.
- **Copy editorial del host visible al huésped** (ver §10). Regla dura: cualquier string visible con imperativo dirigido al host ("Añade...", "Completa...", "Configura...") es bug.
- **JSON / enums / claves técnicas en texto visible al huésped**. Bloqueado por invariantes de 10F.
- **Labels internos** (`"Slot"`, `"Propiedad"`, `"Config JSON"`) en UI guest.
- **Botón sin icono o sin label**. Uno de los dos mínimo + `aria-label`.
- **Tamaño tipográfico fuera de §4** — fuerza a elegir de la escala.
- **Sombras grandes en pills/badges**.
- **Auto-play de vídeo** o audio al cargar la guía.
- **Microinteracciones > 300 ms** fuera de lightbox.
- **Scroll horizontal** fuera de carousels de galería explícitos.
- **Chat del asistente intrusivo** — vive en un botón flotante dismissable, no en modal sobre la guía.
- **"Coming soon"** literal en UI guest. Usar empty state neutro.

---

## Librerías oficialmente recomendadas

Mandatory stack para cualquier rama que toque UI guest a partir de 10F:

| Librería | Uso |
|---|---|
| `@radix-ui/react-accordion` | CollapsibleCard content |
| `@radix-ui/react-dialog`, `@radix-ui/react-drawer` | TOC drawer, issue reporter (13D), lightbox overlay |
| `@radix-ui/react-toast` | Feedback de quick actions |
| `@radix-ui/react-tabs` | Split views (Space A/B) si aparece |
| `@radix-ui/react-tooltip` | Pistas contextuales en desktop (no mobile) |
| `@radix-ui/react-scroll-area` | Scroll horizontal controlado en galerías |
| `@radix-ui/react-visually-hidden` | Labels accesibles sin ocupar layout |
| `lucide-react` | Iconografía única (nunca mezclar con Heroicons o Phosphor) |
| `class-variance-authority` | Variantes Hero/Essential/Standard/Warning |
| `tailwind-merge` + `clsx` | Composición de clases Tailwind |
| `fuse.js` | Client search (10H) |
| `yet-another-react-lightbox` | Galería (lazy import) |
| `date-fns` | Formato de fechas/horas con locale — nunca `Intl.DateTimeFormat` directo en componentes |
| `react-hook-form` + `zod` | Forms interactivos (solo en 13D issue reporting, no en render de la guía) |
| `framer-motion` | **Solo si** una animación específica lo justifica (lightbox, bottom-sheet). Prefiere CSS. |

**No permitidos** en UI guest:
- MUI / Ant Design / Chakra — estilo propio, no se usa un DS genérico.
- `next-pwa` — Service Worker manual (decidido en 10I Fase -1).
- Heavy UI stacks (Mantine, Bulma, Blueprint).
- `shadcn` completo como sistema — se puede tomar patrones puntuales (variantes CVA) pero no copiar bloques wholesale sin adaptar al DS del proyecto.

---

## Tooling obligatorio en cada rama de UX (10F en adelante)

Estas herramientas son **estándar del proyecto** para cualquier rama que toque UX guest — no sugerencias. Romper este contrato = no merge.

- **`@playwright/test`** en 3 viewports (`375x667`, `768x1024`, `1280x800`) con screenshots visuales por cambio relevante.
- **`@axe-core/playwright`** integrado en los specs: 0 violations severity `serious` o `critical`.
- **`/excalidraw-diagram`** para mockups previos a implementar hero / search / issue reporter — commitear el `.excalidraw` en `docs/research/sketches/<rama>-<feature>.excalidraw` antes de abrir Fase 3.
- **Agent `code-architect`** para diseñar registry / presenter / pipeline / separación de responsabilidades antes de escribir código. Su output acompaña el PR como comentario o como archivo en `docs/research/design/`.
- **Agent `code-explorer`** para mapear consumidores del renderer actual y evitar leaks olvidados antes de tocar componentes existentes.
- **`/simplify`** tras implementación significativa y siempre antes de `/pre-commit-review`.
- **`/pre-commit-review`** obligatorio antes de cada commit (§2.6 MASTER_PLAN_V2.md).
- **`/firecrawl-search`** para re-benchmarking competitivo (Touch Stay / Hostfully / Enso / Breezeway / Airbnb) y verificación de docs oficiales de librerías antes de cada rama visible (10G, 10H, 13D). No opcional en ramas de UI nueva.
- **Context7 MCP** (auto) — valida APIs de librerías (Radix, Fuse.js, Zod, RHF) durante implementación.

### Aplicación por rama (estándar del proyecto)

| Rama | Excalidraw antes | code-explorer | code-architect | Playwright 3 viewports | axe-core | Firecrawl benchmark |
|---|---|---|---|---|---|---|
| **10F** `fix/guest-presentation-layer` | — (normalizador, no UI nueva) | ✅ (mapear renderer consumers) | ✅ (registry + shape `displayFields`) | ✅ fixtures empty/rich/adversarial | ✅ | — |
| **10G** `feat/guide-hero-quick-actions` | ✅ mockup hero mobile + desktop | ✅ | ✅ (quick-action-registry) | ✅ | ✅ | ✅ hero + quick actions en Touch Stay / Airbnb |
| **10H** `feat/guide-client-search` | — (overlay estándar) | — | ✅ (shape del index + pesos) | ✅ teclado + focus trap | ✅ | ✅ zero-result UX |
| **10I** `feat/guide-pwa-offline` | — | ✅ (cache-tier flags en secciones) | ✅ (SW strategy + versionado) | ✅ airplane mode simulation | ✅ offline fallback page | — |
| **13D** `feat/guide-issue-reporting` | ✅ wireframe drawer mobile | — | ✅ (email provider + Zod schema) | ✅ flujo completo guest↔host | ✅ drawer abierto | ✅ Breezeway / Hostfully |

`code-explorer` también se invoca puntualmente cuando se toquen varias zonas del renderer que puedan compartir state. `/simplify` y `/pre-commit-review` son universales (§2.6) y no aparecen en la tabla.

---

## Gates de release (antes de hacer merge de cualquier rama UX)

1. TypeScript limpio (`tsc --noEmit` tras `prisma generate`).
2. Vitest verde (incluyendo `guest-leak-invariants.test.ts` y `presenter-coverage.test.ts`).
3. Playwright 3 viewports verde.
4. axe-core 0 violations serious/critical.
5. `/simplify` pasado sobre todos los cambios de la rama.
6. `/pre-commit-review` limpio.
7. Screenshots anexados a la PR (mobile + desktop del flujo afectado).
8. Lighthouse mobile Performance ≥ 90 en la rama que introduce cambios PWA/assets; ≥ 85 para ramas de contenido puro.

Romper cualquiera de estos gates = no merge.
