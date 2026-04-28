# Liora Component Mapping

Living document. Updated by each Liora branch (16B–16G) as work progresses.

Every component in `src/components/ui/` is classified and tracked here. Guest-only cards live in `src/components/public-guide/ui/` (16C onwards) and are tracked separately in `LIORA_SURFACE_ROLLOUT_PLAN.md`.

---

## Legend

| Classification | Meaning |
|---|---|
| `new`        | Component created in this branch; did not exist before |
| `reskinned`  | Same API and behavior; token migration only |
| `rewritten`  | API changed; all call sites updated in same branch |
| `deprecated` | Alias to replacement; call sites migrated in 16G |
| `deleted`    | Removed in this branch (16G) |

---

## src/components/ui/ — 16B state

| Component | Classification | Owner branch | Semantic / Component tokens consumed | Notes |
|---|---|---|---|---|
| `badge.tsx` | `reskinned` | 16B | `--badge-{neutral,success,warning,error}-{bg,fg}`, `--badge-radius`, `--badge-font-size`, `--badge-font-weight`, `--badge-padding-*` | `danger` tone maps to `--badge-error-*` |
| `banner.tsx` | `reskinned` | 16B | `--color-status-{info,warning,error}-{bg,border}`, `--color-text-primary`, `--alert-radius`, `--alert-padding`, `--alert-gap`, `--alert-icon-size` | Added `<Icon>` per type |
| `button.tsx` | `new` | 16B | `--button-{primary,secondary,ghost,destructive}-*`, `--button-height-*`, `--button-padding-x-*`, `--button-radius`, `--button-gap`, `--button-font-*`, `--button-focus-ring`, `--button-disabled-*` | CVA; `asChild` via `@radix-ui/react-slot` |
| `card.tsx` | `new` | 16B | `--card-bg`, `--card-fg`, `--card-border`, `--card-shadow`, `--card-shadow-hover`, `--card-radius`, `--card-padding-*` | Variants: default/elevated/outlined; exports Card+Header+Content+Footer |
| `checkbox-card-group.tsx` | `reskinned` | 16B | `--color-action-primary`, `--color-interactive-selected`, `--color-interactive-selected-fg`, `--color-border-default`, `--color-border-emphasis`, `--color-background-elevated`, `--color-text-primary`, `--color-text-muted` | — |
| `collapsible-section.tsx` | `reskinned` | 16B | `--color-border-default`, `--color-background-elevated`, `--color-text-primary`, `--color-text-muted`, `--color-interactive-selected`, `--color-interactive-selected-fg`, `--color-background-subtle`, `--color-text-secondary`, `--tooltip-bg`, `--tooltip-fg`, `--tooltip-padding`, `--tooltip-radius`, `--tooltip-shadow` | SelectionBadge hover uses tooltip tokens |
| `delete-confirmation-button.tsx` | `reskinned` | 16B | `--color-text-muted`, `--color-action-destructive`, `--color-action-destructive-subtle`, `--color-border-default`, `--color-background-elevated`, `--color-text-primary`, `--color-text-secondary`, `--button-destructive-*`, `--button-disabled-*`, `--input-border`, `--input-bg`, `--input-border-error`, `--input-shadow-error`, `--color-interactive-hover` | Inline SVG replaced with `<Icon name="trash" />` |
| `icon.tsx` | `new` | 16B | `--icon-size-{xs,sm,md,lg,xl}`, `--color-text-secondary`, `--color-text-muted`, `--color-status-{success,warning,error,info}-icon`, `--color-action-primary`, `--color-action-destructive` | Static registry; initial set: check/circle-alert/info/loader/trash/triangle-alert |
| `info-tooltip.tsx` | `reskinned` | 16B | `--tooltip-bg`, `--tooltip-fg`, `--tooltip-padding`, `--tooltip-max-width`, `--tooltip-shadow`, `--tooltip-radius`, `--tooltip-font-size`, `--color-background-subtle`, `--color-border-default`, `--color-text-muted`, `--color-text-secondary` | `bg-gray-900` → `--tooltip-bg`; arrow uses inline borderColor |
| `inline-save-status.tsx` | `reskinned` | 16B | `--color-text-muted`, `--color-status-{success,error}-icon` (via Icon tone) | Added `<Icon>` per status |
| `input.tsx` | `new` | 16B | `--input-{bg,fg,border,border-hover,border-focus,border-error,placeholder,bg-disabled,fg-disabled,height-*,padding-x,radius,font-size,shadow-focus,shadow-error}` | CVA; size sm/md/lg × error/disabled |
| `location-map.tsx` | `reskinned` | 16B | `--color-border-strong`, `--color-background-subtle`, `--color-text-muted`, `--color-border-default`, `--color-action-primary` (runtime via getComputedStyle for marker) | MapLibre marker color via `getComputedStyle`; no hex fallback |
| `number-stepper.tsx` | `reskinned` | 16B | `--color-border-default`, `--color-background-elevated`, `--color-text-primary`, `--color-text-secondary`, `--color-interactive-hover`, `--button-disabled-bg`, `--button-disabled-fg` | — |
| `primary-cta.tsx` | `deprecated` | **16G** | Delegates to `Button variant="primary" asChild` | API preserved; call sites (`src/app/page.tsx`, 2 usages) migrated in 16G |
| `radio-card-group.tsx` | `reskinned` | 16B | `--color-action-primary`, `--color-interactive-selected`, `--color-interactive-selected-fg`, `--color-border-default`, `--color-border-emphasis`, `--color-background-elevated`, `--color-text-primary`, `--color-text-muted` | — |
| `select.tsx` | `new` | 16B | `--input-{bg,fg,border,border-hover,border-focus,shadow-focus,placeholder,bg-disabled,fg-disabled,height-md,padding-x,radius,font-size}`, `--select-chevron`, `--color-interactive-hover`, `--color-action-primary`, `--color-border-subtle`, `--dropdown-item-radius` | Radix Select + foundations skin; composable exports |
| `tabs.tsx` | `new` | 16B | `--tabs-list-border`, `--tabs-list-gap`, `--tab-fg`, `--tab-fg-hover`, `--tab-fg-active`, `--tab-indicator`, `--tab-height`, `--tab-padding`, `--tab-font-size`, `--tab-font-weight`, `--color-border-focus`, `--color-text-disabled` | Radix Tabs + foundations skin |
| `textarea.tsx` | `new` | 16B | `--textarea-min-height`, `--textarea-padding`, `--input-{bg,fg,border,border-hover,border-focus,border-error,placeholder,bg-disabled,fg-disabled,radius,font-size,shadow-focus,shadow-error}` | Shares input tokens; error prop |
| `tooltip.tsx` | `reskinned` | 16B | `--tooltip-bg`, `--tooltip-fg`, `--tooltip-padding`, `--tooltip-max-width`, `--tooltip-shadow`, `--tooltip-radius`, `--tooltip-font-size` | Hover variant; `bg-gray-900` → `--tooltip-bg` |

---

## Radix UI packages — justification

| Package | Used by | Why Radix (not hand-roll) | Alternative considered |
|---|---|---|---|
| `@radix-ui/react-select` | `select.tsx` | Accessibility: keyboard nav, ARIA `listbox`/`option`, screen reader announcements — non-trivial to hand-roll correctly | Native `<select>` (no custom styling on dropdown content across browsers) |
| `@radix-ui/react-tabs` | `tabs.tsx` | ARIA `tablist`/`tab`/`tabpanel`, roving tabindex — already established pattern in this codebase | Plain divs + state (loses a11y guarantees) |
| `@radix-ui/react-slot` | `button.tsx` (`asChild`) | Polymorphic button wrapper without DOM nesting issues | Extra wrapper element (causes double margin/layout bugs) |
| `@radix-ui/react-dialog` | *(pre-existing)* | Pre-existing | — |
| `@radix-ui/react-toast` | *(pre-existing)* | Pre-existing | — |

---

## Guest-only cards (16C)

These card variants are **not** in `src/components/ui/` — they are guest-specific and live in `src/components/public-guide/ui/guide-card.tsx` (created in 16C). Promotion to global requires a dedicated future branch (permanent decision 6).

| Variant | Owner branch |
|---|---|
| `HeroCard` | 16C |
| `EssentialCard` | 16C |
| `StandardCard` | 16C |
| `WarningCard` | 16C |

---

## Removal tracker (16G)

| Item | Type | Replacement | Files to update |
|---|---|---|---|
| `primary-cta.tsx` | deprecated component | `Button variant="primary" asChild` | `src/app/page.tsx` (2 usages) |
| All `legacy-aliases.css` vars | CSS aliases | Semantic foundations tokens | ~92 files — see `liora-legacy-alias-registry.test.ts` |
