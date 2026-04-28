# Warm Analytical Minimalism — Design System

A reusable visual foundation for premium, productive web applications.

## Visual direction
- Warm-neutral foundation (chalk, porcelain, graphite ink)
- Olive primary action; restrained terracotta accent
- Blue-grey reserved for information
- Premium, understated surfaces — borders before shadows
- Calm, near-invisible motion
- Operational density first

## Principles
1. **Information before ornament.** Decoration must improve comprehension or be removed.
2. **One primary, one accent.** Olive for action. Terracotta for emphasis. Blue-grey for info. Status colors carry status. No new accents.
3. **Hierarchy via weight + leading.** Reach for weight before pixels.
4. **Calm motion.** Sub-200ms, gentle easing. Confirms a change, never performs one.
5. **Density is a setting.** `compact | cozy | comfortable` per surface.
6. **Borders before shadows.** Elevation only when surfaces genuinely float.
7. **Tokens are the contract.** Components reference semantic/component tokens — never primitives.

## Token usage rules
- **Application code MUST NOT consume primitive tokens directly. Use semantic tokens or component tokens.**
- **Terracotta/accent colors are reserved for emphasis and MUST NOT be used for generic hover states or common UI backgrounds.**
- **Do NOT introduce new colors, shadows, radii, spacing values, or font styles without adding them to the token system.**
- shadcn `--accent` is mapped to a neutral interactive surface, not terracotta.
- Status badges, alerts, and inline errors must use the four-token quartet (`bg · text · icon · border`).
- Status text on light tints uses `-text` (700-level), never the `-icon` (-600) or raw `-500`.

## Color rules
| Use | Token |
| --- | --- |
| Primary action (one per view) | `--color-action-primary` |
| Selected nav / row | `--color-interactive-selected` |
| Generic hover surface | `--color-action-ghost-hover` |
| Emphasis (one per screen) | `--color-accent-default` |
| Information | `--color-status-info-*` |
| Body text | `--color-text-primary` |
| Help / captions | `--color-text-muted` (≥12px only) |
| Skeleton placeholder | `--color-loading-skeleton` / `--color-loading-shimmer` |
| Progress-bar empty track | `--color-progress-track` |

## Typography rules
- `IBM Plex Sans` — all UI.
- `Newsreader` — editorial / marketing-grade headings, sparingly.
- `IBM Plex Mono` — IDs, timestamps, code, tabular numerics.
- Don't drop below 12px. Don't go above 38px in product UI.
- Body weight is 400, labels 500, headings 500.

## Component rules
- Components consume `--{component}-*` tokens defined in `components.css`.
- Use the four button variants (`primary | secondary | ghost | destructive`) — no new variants without a token entry.
- Inputs share `--input-height-{sm|md|lg}` with buttons for vertical alignment.
- Modals always reach for `--shadow-xl`. Cards use `--shadow-sm` or none.
- Tables default to `compact` density on operational surfaces.

## Dark mode rules
- Toggle by setting `data-theme="dark"` on `<html>`.
- All semantic tokens have a dark binding; primitives never change.
- Do not swap fonts or radii in dark mode.
- Shadows become weaker in dark; rely on `--color-border-*` for separation.

## Accessibility rules
- WCAG AA at 14px. Status `-text` on `-bg` ≥ 5.0:1.
- Status `-icon` is for icons/dots, not for body text.
- Focus is always visible (`:focus-visible` 2px ring).
- Color is never the only signal — pair status color with an icon, dot, or label.
- Disabled controls keep `opacity 0.5` and remain readable.

## Implementation rules
- Import once at the app root: `design-system/foundations/styles/base.css`.
- Tailwind: `theme.extend = warmAnalyticalTheme` (from `foundations/tokens/tailwind.tokens.ts`).
- shadcn: `foundations/tokens/shadcn.css` is the bridge — do not patch shadcn variables elsewhere.
- Theme per product by overriding semantic tokens inside a scoped `[data-theme-brand="…"]` selector — never primitives.

## Anti-patterns
- ❌ Purple/blue AI gradients
- ❌ Glassmorphism, heavy drop shadows, dual-tone gradients on cards
- ❌ Decorative emoji-as-icon
- ❌ Rainbow charts (use chart-1…6, semantic where it adds meaning)
- ❌ Two accents on one screen
- ❌ Primary used for non-action elements (rules, dividers, decorative bars)
- ❌ Status text in `-icon` or `-500` on light tints
- ❌ New radii outside the closed scale (xs/sm/md/lg/xl/2xl/full)

## File map
```
/design-system
  /foundations
    /tokens
      primitives.css        raw scales, sizing, motion
      semantic.css          --color-* + dark mode
      components.css        --{component}-* tokens
      shadcn.css            shadcn/ui bridge
      tokens.json           W3C token tree
      tailwind.tokens.ts    theme.extend export
    /styles
      base.css              resets, focus, motion preferences
      themes.css            theme activation strategy
    /docs
      Foundation.html       this living spec
      DESIGN_SYSTEM.md      rules (this file)
      IMPLEMENTATION.md     React/Next.js/Tailwind/shadcn setup
      ACCESSIBILITY.md      WCAG matrix and pairings
```
