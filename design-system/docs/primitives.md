# Primitivos React — política Liora 16D.5

8 primitivos compuestos sobre tokens + recipes que cubren los patrones recurrentes del shell operator. Viven en [src/components/ui/](../../src/components/ui/) y son consumidos por surfaces auditadas (hoy: overview + layout). Su existencia permite que invariantes de tests (`primitive-adoption`, `touch-target`, `tone-quartet`) operen sobre nombres de componente o classNames bakeados, sin tener que escanear cada combinación posible.

## Política — path rule

- **Genéricos** (reutilizables across surfaces): [src/components/ui/](../../src/components/ui/). Caso de los 8 primitivos catalogados aquí.
- **Surface-only** (utilidad confinada a una surface): junto a la surface en su carpeta (`src/components/overview/*`, `src/components/messaging/*`). No subir a `ui/` hasta que haya ≥2 consumers en surfaces distintas.
- **Recipes CSS** (patrones globales no expresables en Tailwind): [src/styles/recipes.css](../../src/styles/recipes.css). Documentados en [recipes.md](recipes.md).

## Política — qué NO hacer

- **No** usar `as="a"` polymorphism. Componentes para `<Link>` (`<ButtonLink>`, `<IconButtonLink>`, `<TextLink>`) son separados de sus equivalentes `<button>` (`<IconButton>`). Polymorphism rompe el invariante `touch-target` (el walker JSX detecta `<button>` y `<Link>`/`<a>` separadamente — un componente `as="a"` se vuelve invisible al gate).
- **No** escribir className raw para obtener surface fill o outline button-style. Si el className matchea la firma button-shape (`bg-[var(...)]` no-hover OR `border + border-[var(...)] + rounded-[...]`) sin estar dentro de un primitivo, el invariante `touch-target` flagea. La regla es: si vas a escribir un botón, parte siempre de un primitivo. Solo bajas a className raw cuando el primitivo no expresa la variación responsiva — y entonces bake `recipe-icon-btn-32` o `min-h-[44px]`.
- **No** inline `Record<BadgeTone, string>` en feature code. La paleta de tonos vive en [src/lib/tone.ts](../../src/lib/tone.ts) (`TONE_DOT_BORDER`, `TONE_BG_SOFT`, `TONE_TEXT`, `TONE_BORDER`). Inline tone-quartets se prohíben por el invariante `tone-quartet` para evitar drift de paleta.
- **No** introducir versiones paralelas (`*V2`, `*New`, `*Alt`, `*Redesign`). Si la API de un primitivo necesita cambiar, se cambia en su sitio.

## Catálogo

### `<Card variant="overview">`

Shell canónico de overview cards. Bakea el contrato `flex h-full flex-col + rounded-lg + border-default + bg-elevated + p-4` vía variant `overview` (CVA-based, otros variants son `default`/`elevated`/`outlined`).

**Path**: [src/components/ui/card.tsx](../../src/components/ui/card.tsx)

```tsx
import { Card } from "@/components/ui/card";

<Card variant="overview" className="...optional layout overrides...">
  {children}
</Card>
```

**Cuándo usar**: cualquier overview card que matchee el shell canónico. Cards con shell distinto (overflow containers, grid layouts, p-5 hero) **no** migran — el variant `overview` es para el patrón estándar, no un genérico.

**Don't**: anidar `<CardHeader>`/`<CardContent>` dentro de `variant="overview"` — esos primitivos llevan su propio padding (`var(--card-padding-md) = var(--space-5)`), distinto a `p-4`. Doble-padding rompe el shell. Los children del overview Card son markup directo.

### `<SectionEyebrow icon={Icon}>`

Header de sección dentro de una card (sm + semibold + text-primary + flex items-center gap-2). Default render `<h3>`; el icono opcional aparece a la izquierda.

**Path**: [src/components/ui/section-eyebrow.tsx](../../src/components/ui/section-eyebrow.tsx)

```tsx
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { ListChecks } from "lucide-react";

<SectionEyebrow icon={ListChecks}>Tareas</SectionEyebrow>
```

**Don't**: forzar `<h2>`/`<h4>` con `as` — no soporta polymorphism. Si necesitas un nivel de heading distinto, usar markup directo con `recipe-eyebrow`.

### `<IconBadge icon={Icon} tone="neutral|success|warning|danger|primary">`

Cuadrado decorativo (30×30 sm o 36×36 md) con icono centrado y background tonal. `aria-hidden="true"` baked — siempre decorativo, nunca interactivo.

**Path**: [src/components/ui/icon-badge.tsx](../../src/components/ui/icon-badge.tsx)

```tsx
import { IconBadge } from "@/components/ui/icon-badge";
import { BedDouble } from "lucide-react";

<IconBadge icon={BedDouble} tone="neutral" />
```

**Tone keys**: 5 (`neutral` + 4 status). El primitivo lleva un key extra (`primary`) por encima de `BadgeTone` (4 keys) precisamente para evitar el invariante `tone-quartet` (que prohíbe `Record<BadgeTone, ...>` inline en feature code) — `IconBadgeTone` ≠ `BadgeTone` por diseño.

**Don't**: usarlo como botón. Si necesitas un botón con icono, es `<IconButton>`/`<IconButtonLink>`.

### `<TextLink href={...} size="xs|sm|md" arrow>`

Link inline (text-link + hover:underline). Tamaños xs (11px) / sm (12px) / md (13px). Prop `arrow` añade ` →` al final del children.

**Path**: [src/components/ui/text-link.tsx](../../src/components/ui/text-link.tsx)

```tsx
import { TextLink } from "@/components/ui/text-link";

<TextLink href={`/properties/${id}/spaces`} size="sm" arrow>
  Ver los 3 restantes
</TextLink>
```

**Cuándo usar**: links inline en flujo de lectura (footer de card "Ver más", "Editar"). WCAG 2.5.8 inline exception aplica — no requieren 44×44.

**Don't**: usar para CTAs sólidos. Si necesitas surface fill, es `<ButtonLink>`.

### `<TimelineList items={[...]} emptyText="...">`

Lista vertical con líneas/dots tonal-bound (TONE_DOT_BORDER). Cada item: `{id, tone?, content, meta?}`. Empty state opcional.

**Path**: [src/components/ui/timeline-list.tsx](../../src/components/ui/timeline-list.tsx)

```tsx
import { TimelineList } from "@/components/ui/timeline-list";

<TimelineList
  items={[
    { id: "a", tone: "success", content: "Item completado", meta: "hace 2h" },
    { id: "b", tone: "warning", content: "Item en alerta" },
  ]}
  emptyText="Sin actividad reciente"
/>
```

**Don't**: pasar items con `tone` fuera de `BadgeTone` (4 keys: `neutral|success|warning|danger`). El primitivo se compone con la fuente de verdad de `tone.ts`; añadir tones nuevos = editar `tone.ts` + tipos en `lib/types`.

### `<IconButton icon={Icon} size="sm|md" tone="neutral|primary" aria-label>`

Botón icon-only `<button>`. `size="md"` produce 44 visual (h-11 w-11); `size="sm"` produce 32 visual + slop = 44 hit (vía `recipe-icon-btn-32`). `aria-label` es required (TS lo exige).

**Path**: [src/components/ui/icon-button.tsx](../../src/components/ui/icon-button.tsx)

```tsx
import { IconButton } from "@/components/ui/icon-button";
import { Bell } from "lucide-react";

<IconButton icon={Bell} size="sm" tone="neutral" aria-label="Notificaciones" />
```

**Cuándo `size="md"`**: surfaces táctiles primary (mobile drawer, messaging mobile) — visual 44 directo es la affordance correcta.
**Cuándo `size="sm"`**: surfaces densas desktop (topbar icons) — el slop satisface el invariante sin agrandar el visual.

**Don't**: omitir `aria-label`. El componente exige string, pero un valor vacío también pasa el typecheck — no engañar con `aria-label=""`.

### `<IconButtonLink icon={Icon} href={...} size="sm|md" tone>`

Versión `<Link>` de `IconButton`. Mismo contrato de sizes/tones, mismas reglas.

**Path**: [src/components/ui/icon-button-link.tsx](../../src/components/ui/icon-button-link.tsx)

```tsx
import { IconButtonLink } from "@/components/ui/icon-button-link";
import { Settings } from "lucide-react";

<IconButtonLink
  icon={Settings}
  size="md"
  tone="neutral"
  href={`/properties/${id}/settings`}
  aria-label="Ajustes"
/>
```

**Cuándo NO usar**: cuando necesitas transiciones responsivas de width (icon-only mobile → icon+text desktop). El primitivo es icon-only por contrato — para esos casos, baja a className raw + `recipe-icon-btn-32`. Documentado en topbar (`Vista huésped`, `Publicar`).

### `<ButtonLink href={...} variant="primary|secondary" size="sm|md|lg">`

Link tipo botón con surface fill. Variants `primary` (action-primary) / `secondary` (border + bg-elevated). Sizes sm (32 visual) / md (44 visual) / lg (44 visual con padding mayor).

**Path**: [src/components/ui/button-link.tsx](../../src/components/ui/button-link.tsx)

```tsx
import { ButtonLink } from "@/components/ui/button-link";

<ButtonLink href={`/properties/${id}/spaces/new`} variant="secondary" size="md">
  Añadir espacio
</ButtonLink>
```

**Cuándo `size="sm"`**: el primitivo NO bakea slop para size sm — un `ButtonLink size="sm"` text-bearing tiene 32 visual con 32 hit area. Razón: slop sobre texto rompe la affordance visual (documentado en [touch-targets.md](touch-targets.md)). Usar `size="md"` (44 visual) por default; `size="sm"` solo en surfaces no-auditadas (admin internal, etc.).

> **Nota de enforcement**: el invariante `touch-target` opera sobre tags literales (`<button>`, `<Link>`, `<a>`) — no detecta `<ButtonLink size="sm">` porque el wrapper Next `<Link>` queda dentro del primitivo. La regla "no usar `ButtonLink size="sm"` en surfaces auditadas" es **convención**, no enforced. Para subir el rigor a static-check (16E o posterior), añadir un walker JSX que matchee `<ButtonLink ... size="sm" ...>` en `AUDITED_SURFACES` directamente.

**Don't**: añadir `hover:underline`. El primitivo bakea `hover:no-underline` precisamente para defenderse del `a:hover { text-decoration: underline }` global de `base.css` (specificity 0,1,1 — beats Tailwind arbitraries). Si reescribes el hover en consumer, abres ese bug.

## Extender

Para añadir un primitivo nuevo:

1. Verificar que el patrón se repite ≥3 veces en feature code — sin reuso real, no hay primitivo.
2. Crear el archivo en [src/components/ui/](../../src/components/ui/).
3. Si el primitivo expone tones, **componer desde `tone.ts`** — no inline `Record<BadgeTone, string>`. El invariante `tone-quartet` lo enforza.
4. Si el primitivo es button-shaped, exigir `size="md"` por default (44 visual). Si soporta `size="sm"`, bakear `recipe-icon-btn-32` solo cuando sea icon-only.
5. Documentar aquí: path / props / ejemplo / Don't list.
6. Si reemplaza un patrón duplicado en feature code, refactor del feature code en la misma rama (no diferir a "16E").
