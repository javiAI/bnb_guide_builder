# Guest Guide Visual System — DESIGN.md

A vacation-rental guide for guests. Mobile-first, premium hospitality, calm. Prefix all output tokens `--guest-*`. All UI copy in Spanish (es-ES).

## 1. Visual Theme & Atmosphere

**Two personas, both served. Primary takes precedence in conflict.**

- **Primary — distracted on mobile.** Low battery. Slow data. One hand. Outdoors. Partial attention. Each screen serves ONE task: arrive, settle, follow rules, get help, leave. Mobile-first is non-negotiable.
- **Secondary — attentive reader.** Arrives early, sits down, reads cover-to-cover. Wants coherence, rhythm, depth. Typography and spacing must hold for sustained reading on desktop.

**Mood**: premium hospitality, calm, confident, warm-but-restrained. Density: roomy on mobile (one decision per screen); cohesive on desktop (a content max-width that holds reading rhythm — propose the value).

**Positive mood anchors** — design within these registers:
- **Boutique hospitality digital companion** — the in-room tablet of an Aman, Six Senses, Casa Bonay. Restrained, considered, never corporate.
- **Editorial travel publication** — Cereal, Apartamento, Kinfolk. Generous typography, photography that breathes, headings that invite reading.
- **Curated residential interior** — the calm of a designed home. Soft contrast, materials hinted through color, never sterile.
- **High-end consumer goods detail** — Aesop, Loro Piana. Typography as object, restraint as luxury signal.

**The guest is hosted, not operated.** If a direction reads as a panel, dashboard, instruction card, museum cartela, or transit display, it is wrong audience — even if it's "designed well".

**Reject as defaults** (do not auto-fall-back):
- **Claude house style**: cream `#F4F1EA` + serif (Georgia / Fraunces / Playfair) + terracotta italic accents. If a direction tends there, swap a primary axis (serif→slab, cream→warm-grey, drop italic).
- **Operational/institutional registers**: transit-board displays, dashboards, instruction-card kits, museum cartelas, ranger pamphlets, spec sheets. Wrong audience.
- **Tech-dashboard aesthetic**: gridded cards, dense numerical data, productivity icons. Wrong audience.
- **Marketing/hotel-landing**: hero-photo-with-headline, autoplay video, parallax. Wrong audience.

## 2. Color Palette & Roles

**Two themes always paired**: light + dark via `[data-theme="dark"]` flip on `<html>`. Never light-only.

**Base scale**. Propose your own primitive scale (12+ stops, OKLCH preferred). Name it (e.g. "stone", "fog", "linen", "clay"). Prefix every output token `--guest-*`.

**Required semantic roles** (populate ALL for both themes):

- Background: `page`, `surface`, `subtle`, `muted`, `elevated`, `inverse`, `overlay`, `scrim`
- Text: `primary`, `secondary`, `muted`, `subtle`, `inverse`, `link`, `link-hover`, `disabled`, `placeholder`, `on-accent`, `on-overlay`
- Border: `subtle`, `default`, `strong`, `emphasis`, `focus`, `error`, `success`, `warning`, `info`
- Action (`primary` / `secondary` / `ghost` / `destructive`): `base`, `hover`, `active`, `fg`, `subtle`, `subtle-fg`
- Status (`success` / `warning` / `error` / `info`): `bg`, `text`, `icon`, `border`, `solid`, `solid-fg`

**Brand palettes** — per-property accent layer, INJECTED at runtime (not part of base). 8 curated keys, each with a light + dark hex pair pre-validated ≥4.5:1. They map to `--guest-brand-light`, `--guest-brand-dark`, `--guest-brand` (theme-aware), `--guest-brand-fg`. The system MUST hold **≥7:1 hero text contrast** across all 8 brands × light/dark.

| key | light hex | label |
|---|---|---|
| indigo | `#4F46E5` | Índigo |
| teal | `#0F766E` | Turquesa |
| coral | `#B91C1C` | Coral |
| olive | `#4D7C0F` | Oliva |
| navy | `#1D4ED8` | Azul marino |
| plum | `#9333EA` | Ciruela |
| sienna | `#9A3412` | Siena |
| slate | `#475569` | Pizarra |

Phase 4 stress-tests three representative brands: **coral** (warmest, hardest contrast on light), **indigo** (coolest, strong saturation), **sienna** (dark mode interaction).

## 3. Typography Rules

**Pin one heading family + one body family + one mono family**. Each direction commits — never "Inter or IBM Plex". Provide Google Fonts fallbacks.

**Type scale**: propose a coherent ramp (display / h1 / h2 / h3 / body / small / micro).
- **Mobile body MUST be ≥16px** — iOS auto-zoom prevention, non-negotiable.
- Headings must support sustained reading on desktop for the attentive reader.

Specify: heading weights, body weights, capitalization rules, italic usage (allowed/forbidden), tracking on display sizes, line-height by size.

**Voice of microcopy** (pick ONE per direction): warm-conversational / editorial-warm / quietly-confident. Spanish (es-ES) primary. AVOID clinical, utility-laconic, transactional — the guest is being hosted, not given operating instructions. NEVER host-editorial ("Añade…", "Configura…", "Completa…") — the guest receives the guide, never edits it.

## 4. Component Stylings

For each component, specify light + dark, with all states: rest, hover, active, focus-visible, disabled, loading.

- **Button**: primary / secondary / ghost / destructive × sm / md / lg.
- **Input**: default / focus-visible / error / disabled. Placeholder treatment.
- **Badge**: 4 status (success / warning / error / info) + neutral.
- **Toast**: success / info / warning / error.
- **Drawer**: mobile bottom-sheet + desktop right-side. Open + closed.
- **Lightbox**: image full-bleed + caption + close affordance.
- **Pill / Chip**: selected + unselected.
- **Card system**: propose 3–4 variants representing hierarchy (L1 hero / L2 essential / L3 standard / warning). Naming free; each variant must be visually distinguishable **without relying on color alone** — a colorblind reader must read the hierarchy.

## 5. Layout Principles

**Spacing scale**: propose a coherent rhythm (e.g. `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`). No off-grid one-offs.

**Grid**: 1 column at all breakpoints. Content max-width on desktop: propose a value that holds reading rhythm. TOC: drawer-only on mobile; optional persistent on desktop large.

**Whitespace**: generous on mobile (one decision per screen); tighter on desktop (cohesion across long-form). Section transitions visible, not abrupt.

**Touch target minimum**: 44×44 visual + 12 px padding (WCAG 2.5.8). Inline text links exempt (WCAG inline target exception).

## 6. Depth & Elevation

**Shadows**: propose a coherent system (e.g. `shadow-sm` / `-md` / `-lg` / `-xl`). Light theme: subtle, soft. Dark theme: less shadow, more border-light contrast (heavy shadows on dark surfaces look murky).

**Surface hierarchy**: page < surface < elevated < overlay. Each level visually distinguishable.

**Borders as elevation**: in dark mode, prefer `--guest-color-border-*` to distinguish surfaces over heavy shadows.

## 7. Do's and Don'ts

**DO**:
- Pair every screen light + dark.
- Use real Spanish content. No lorem ipsum.
- Show `:focus-visible` on at least one interactive element per artboard.
- Show empty states explicitly.
- Mobile-first: design 375×667 first, scale up.
- Hold ≥7:1 contrast for hero text on accent surfaces.

**DON'T**:
- Default to operational/institutional registers (transit board, dashboard, instruction card, museum cartela, ranger pamphlet, spec sheet).
- Use hardcoded hex outside the design system.
- Add a 5th card variant beyond what hierarchy needs.
- Show JSON keys (`am.wifi`, `sp.bedroom`, `rm.smoking`) as visible text.
- Show internal labels (`Slot`, `Propiedad`, `Config JSON`, `Raw`).
- Show host-editorial copy ("Añade…", "Configura…", "Completa…").
- Use carousels, autoplay video, parallax, hover-zoom on cards, spring/overshoot animations.
- Default to Claude house style (cream + serif + terracotta).
- Use chat overlay modals or "Coming soon" literals.

## 8. Responsive Behavior

**Breakpoints**: `375` (mobile, iPhone 13 mini), `768` (tablet), `1280` (desktop), `1680` (desktop large).

- **Mobile (375)** — 1 column, full-width cards, drawer for TOC, bottom-sheet for actions, thumb-zone aware (primary actions in bottom 60% of viewport, right edge default).
- **Tablet (768)** — 1 column with breathing room, optional 2-column for gallery layouts, drawer or persistent sidebar.
- **Desktop (1280)** — 1 main column with content max-width, optional left sidebar TOC, generous whitespace.
- **Desktop large (1680)** — same content max-width as 1280, gutters expand. Avoid stretching content width — reading rhythm beats screen-filling.

**Microinteractions**: ≤180ms ease-out. `prefers-reduced-motion` respected (disable transitions).

## 9. Agent Prompt Guide

Reusable prompts for downstream Claude Code consumption (post-handoff):

- "Generate a guest section component for `<section_id>` consuming `--guest-*` tokens, mobile-first, with light + dark theme via `[data-theme=dark]`."
- "Add an empty-state for section `<id>` using `emptyCopyGuest` from `taxonomies/guide_sections.json`. Never show host-editorial copy."
- "Apply the brand palette from `GuideVersion.brandPaletteKey` by reading `src/config/brand-palette.ts` and injecting `--guest-brand-light` / `--guest-brand-dark`."
- "Wrap interactive elements in 44×44 hit areas (visual or slop)."
- "When a section has `hideWhenEmptyForGuest: true` and no content, omit it from TOC and the page entirely. When `emptyCopyGuest` is defined, render that copy as a neutral message — never `emptyCopy` (host-facing)."

---

## Sections to design (frozen taxonomy — do not invent new ones)

The 9 sections come from `taxonomies/guide_sections.json`. Render order:

1. **Esenciales** (`gs.essentials`) — hero + aggregator. journeyStage `arrival`, cacheTier 1. Quick actions: `wifi_copy`, `call_host`, `whatsapp_host`, `maps_open`, `access_how`.
2. **Llegada** (`gs.arrival`) — access method (code / key / lockbox), check-in time, address. cacheTier 1.
3. **Espacios** (`gs.spaces`) — card per space + media gallery. cacheTier 2.
4. **Cómo usar** (`gs.howto`) — collapsible runbooks per system. cacheTier 3.
5. **Equipamiento** (`gs.amenities`) — recommended-first; wifi prominently with copy-to-clipboard. cacheTier 2.
6. **Normas de la casa** (`gs.rules`) — smoking / pets / noise / events as L2 cards. `emptyCopyGuest`: "No hay normas adicionales destacadas para esta estancia." cacheTier 2.
7. **Salida** (`gs.checkout`) — time, key return, surcharges. cacheTier 1.
8. **Guía local** (`gs.local`) — map + place categories + events strip. cacheTier 3.
9. **Ayuda y emergencias** (`gs.emergency`) — warning cards + tel: + wa.me. `emptyCopyGuest`: "Si necesitas ayuda durante la estancia, contacta con tu anfitrión." cacheTier 1.
