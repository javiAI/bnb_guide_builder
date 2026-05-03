# CSS recipes — política Liora 16D.5

Las **recipes** (`recipe-*` classes) viven en [src/styles/recipes.css](../../src/styles/recipes.css) y son globales (cargadas desde `globals.css`). Existen para centralizar patrones que las primitivas React consumen — su razón de ser es que un sistema de tokens + Tailwind no expresa bien dos cosas: (1) **pseudo-elementos** (slop hit-area), (2) **media queries condicionales** (coarse vs. fine pointers). Cuando una primitiva necesita una de esas dos cosas, baja a una recipe.

## Alcance — operator-shell recipes

Las recipes catalogadas aquí son consumidas por primitivas de **operator-shell** (surfaces con `profile: "operator" | "shared"` en `AUDITED_SURFACES`). Guest public guide tiene su propio sistema visual en [src/components/public-guide/ui/](../../src/components/public-guide/ui/) y no consume estas recipes — ver [primitives.md § alcance](primitives.md#política--alcance-operator-vs-guest-16d5).

## Política de uso

- **Consumo preferente**: desde primitivas en [src/components/ui/](../../src/components/ui/). El usuario de feature code idealmente nunca escribe `recipe-*` a mano.
- **Consumo directo permitido pero excepcional**: cuando una primitiva no expresa una variación responsiva concreta (caso documentado: `Vista huésped` y `Publicar` en topbar — icon+text con transiciones de width que `IconButtonLink` icon-only no cubre). En esos casos, el className raw del feature lleva la recipe + el resto de tokens, y la recipe centraliza el truco no-Tailwind.
- **Prohibido**: re-implementar el mismo patrón ad-hoc con `::before` inline o media queries en CSS de feature. Si necesitas una variante de slop que la recipe actual no cubre, **se extiende la recipe** (o se crea una nueva en `recipes.css`), nunca se duplica el patrón.
- **Naming**: `recipe-<intent>-<variant?>`. Ej. `recipe-icon-btn-32` (intent: icon-btn; variant: 32 visual). Sin abreviaturas opacas.

## Catálogo

### `.recipe-card-shell`

Shell canónico de overview cards. Flex column + radius lg + border default + bg elevated + p-4.

```css
.recipe-card-shell {
  @apply flex h-full flex-col
         rounded-[var(--radius-lg)]
         border border-[var(--color-border-default)]
         bg-[var(--color-background-elevated)]
         p-4;
}
```

**Cuándo usar**: la consume `<Card variant="overview">`. No usar directamente en feature code — preferir el primitivo. La existencia de la recipe permite que el invariante `primitive-adoption` detecte el shell canónico mediante una regex que mira el className renderizado, sin tener que parsear cada combinación token-bound posible.

### `.recipe-eyebrow`

Header de sección operator (sm + semibold + text-primary + flex items-center gap-2 para iconos lead).

```css
.recipe-eyebrow {
  @apply flex items-center gap-2
         text-sm font-semibold
         text-[var(--color-text-primary)];
}
```

**Cuándo usar**: la consume `<SectionEyebrow>`. Reuso fuera del primitivo solo si necesitas un nivel de heading distinto (`h2`/`h4`) — el primitivo es `<h3>` por default.

### `.recipe-text-link`

Link inline (xs + medium + text-link + hover:underline). Versión más densa que `<TextLink>` (ese es 11px → 13px responsive); `recipe-text-link` baja a 11px fijo.

```css
.recipe-text-link {
  @apply text-[11px] font-medium
         text-[var(--color-text-link)]
         hover:underline;
}
```

**Cuándo usar**: solo en surfaces densas donde 11px es el tamaño de microcopy (footers de cards de overview con CTA secundario). Para uso general preferir `<TextLink size="sm">` o `size="md">`.

### `.recipe-interactive-hover`

Estados de hover/focus para surfaces interactivas neutras (sidebar, drawer items, list rows). Centraliza el contrato `transition-colors + hover:bg-interactive-hover + hover:text-primary + focus ring`.

```css
.recipe-interactive-hover {
  @apply transition-colors
         hover:bg-[var(--color-interactive-hover)]
         hover:text-[var(--color-text-primary)]
         focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-[var(--color-border-focus)];
}
```

**Cuándo usar**: items de listado interactivos sin surface fill (Atajos en publishing rail, items de side-nav). Si el item lleva surface fill propio (botón sólido), usar el contrato baked en `IconButton`/`ButtonLink` — esa lleva además `hover:no-underline` para defenderse del `a:hover { text-decoration: underline }` global.

### `.recipe-icon-btn-32`

**La recipe más importante**. Slop hit-area: 32 visual + 6px ::before slop por lado = 44 hit area en fine pointers. En coarse pointers (touch primary), el visual mismo crece a 44 — la slop colapsa.

```css
.recipe-icon-btn-32 {
  position: relative;
}
.recipe-icon-btn-32::before {
  content: "";
  position: absolute;
  inset: -6px;  /* 32 + 6 + 6 = 44 hit area */
}
@media (pointer: coarse) {
  .recipe-icon-btn-32 { min-height: 44px; min-width: 44px; }
  .recipe-icon-btn-32::before { inset: 0; }
}
```

**Cuándo usar**:

- **Vía primitivo** (preferente): `<IconButton size="sm">` y `<IconButtonLink size="sm">` la bakean. Mejor camino para botones icon-only.
- **Vía className raw** (excepcional): cuando el botón tiene transiciones responsivas de width (icon-only mobile → icon+text desktop) que el primitivo icon-only no expresa. Caso documentado en topbar: `Vista huésped` (mobile: oculto; sm+: icon+text) y `Publicar` (mobile: 32×32 icon-only; sm+: icon+text auto width).

**Cuándo NO usar**:

- Mobile-only surfaces (mobile drawer, messaging primario táctil) — preferir visual 44 directo (`size="md"` o `min-h-[44px]`). El auto-collapse vía coarse-pointer media query funciona, pero documenta peor: el lector tiene que saber que la media query existe para entender que el visual final será 44.
- Botones text-bearing en general — slop sobre texto agranda hit area pero deja la affordance visual confusa (el usuario pulsa "fuera" del botón visible).
- Elementos no button-shaped — el recipe es para slop de **botones**, no para padding genérico de un `<span>` decorativo.

Política completa de touch targets en [touch-targets.md](touch-targets.md).

## Extender

Para añadir una recipe nueva:

1. Verificar primero que el patrón no se puede expresar con Tailwind tokens directos — si Tailwind cubre el caso, no hace falta recipe.
2. Editar [src/styles/recipes.css](../../src/styles/recipes.css) con `@apply` cuando sea posible (mantiene la línea trazable a tokens) y CSS raw solo para pseudo-elementos / media queries / cosas que `@apply` no expresa.
3. Documentar en este archivo: cuándo usar / cuándo NO usar / ejemplo de consumo desde primitivo.
4. Si la recipe se usa desde una primitiva, el primitivo es el consumer canónico — el feature code idealmente nunca la escribe a mano. Documentar la excepción si la hay.
