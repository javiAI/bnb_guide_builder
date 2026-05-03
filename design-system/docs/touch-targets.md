# Touch targets — política Liora 16D.5

Toda interfaz operator debe satisfacer **WCAG 2.5.5 (Target Size — Minimum)**: cada elemento clickable button-shaped alcanza un **hit area ≥ 44×44 CSS px**. La invariante está hardcoded en `src/test/component-invariants.test.ts` regla 1 y aplica sobre `AUDITED_SURFACES` (hoy: overview + layout + theme-toggle).

## Cuándo aplica

El test detecta button-shape por una de dos firmas en el className:

1. **Surface fill**: `(?<!hover:)bg-[var(--color-...)]` — un fondo no-hover que indica botón sólido.
2. **Outline shape**: `border` + `border-[var(--color-...)]` + `rounded-[...]` — borde token-bound + radius indica botón outlined.

Un elemento que matchea cualquiera de las dos firmas debe alcanzar 44 hit area mediante uno de estos tokens en su className:

- `min-h-[44px]` / `min-h-11` / `min-h-12`
- `h-11` / `h-12` / `h-14` / `h-16`
- `recipe-icon-btn-32` (slop)

Cualquier otro caso falla el test.

## Cuándo NO aplica

**Inline text links** (links sin `bg-[...]` ni outline button-style, p.ej. `<TextLink>`) están **exentos** por WCAG 2.5.8 (Target Size — Inline Exception). El test los excluye automáticamente de la regla. Razón: son parte del flujo de lectura, no controles aislados; aplicar 44×44 distorsionaría el line-height del párrafo.

Elementos `aria-hidden="true"` también se excluyen — no entran en el focus order ni en el AT tree.

## Patrones aceptados (en orden de preferencia)

### 1. Visual 44 — `<IconButton size="md">` o `min-h-[44px]`

```tsx
import { IconButton } from "@/components/ui/icon-button";

<IconButton icon={Menu} size="md" tone="neutral" aria-label="Abrir navegación" />
```

`size="md"` produce `grid h-11 w-11 place-items-center` + tone classes. Es el default para:

- Botones text-bearing (siempre 44 visual — el slop sobre texto rompe lectura).
- Surfaces mobile-only (`pointer:coarse` por defecto, slop colapsa a 44 visual de todos modos — mejor declararlo explícito).
- Drawer triggers, modal close buttons, primary CTAs en messaging.

### 2. Slop 32→44 — `<IconButton size="sm">` o `recipe-icon-btn-32`

```tsx
<IconButton icon={Bell} size="sm" tone="neutral" aria-label="Notificaciones" />
```

`size="sm"` produce `recipe-icon-btn-32 grid h-8 w-8 place-items-center`. La clase recipe agrega:

```css
.recipe-icon-btn-32 { position: relative; }
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

Resultado: en desktop (fine pointers) el botón ocupa 32×32 visualmente pero captura clics en 44×44; en touch (coarse pointers) el visual mismo crece a 44×44 (la slop colapsa).

Default para:

- Topbar icon-only en desktop (Bell, theme toggle, etc. — surfaces densas donde 44 visual sería visualmente pesado).
- Vista huésped y Publicar Links en topbar (icon+text con responsive width transitions).

**No usar slop en**:

- Mobile-only surfaces (preferir visual 44 directo — auto-collapse vía media query funciona pero documenta peor).
- Surfaces con primary táctil (messaging, mobile drawer).
- Botones text-bearing en general — el slop sobre texto agranda hit area pero deja la affordance visual confusa.

## Do / Don't

✅ **Do**: empezar siempre por `<IconButton>` / `<IconButtonLink>` / `<ButtonLink>`. Solo bajar a className raw cuando hay variations responsivas que el primitivo no expresa (caso de Vista huésped + Publicar en topbar) — y entonces bake `recipe-icon-btn-32` o `min-h-[44px]`.

❌ **Don't**: añadir entries a `TOUCH_TARGET_EXCEPTIONS` para diferir un fix. La excepción es para elementos que **se van a refactorizar en la misma rama** que la añade — `removeBy` siempre apunta a la rama propia, nunca a una futura. Si el fix no cabe en la rama, el scope está mal dimensionado.

❌ **Don't**: aplicar `recipe-icon-btn-32` a elementos que NO son button-shaped (un `<span>` decorativo no necesita hit area). El recipe es para slop de botones, no para padding genérico.

❌ **Don't**: usar pseudo-elementos `::before` ad-hoc en feature code para hackear hit area. El recipe centraliza el patrón — una segunda implementación divergeré bajo media queries.

## Test gate

`src/test/component-invariants.test.ts` regla 1 enumera todos los `<button>` / `<Link>` / `<a>` open tags de cada surface auditada (vía walker JSX brace-aware), evalúa la firma button-shape, y rechaza los que no alcanzan 44. Output:

```
src/components/layout/topbar.tsx:73  <Link> button-shaped but missing min-h-[44px] / h-11 / recipe-icon-btn-32
```

Para aceptar temporalmente una violación: añadir entry a `TOUCH_TARGET_EXCEPTIONS` en `src/test/parity-allowlist.ts` con `reason` específico y `removeBy` ≤ rama actual.
