# Accessibility Guide

The system targets **WCAG 2.1 AA** at 14px body size and approaches **AAA** for primary text. Numbers below are computed against the OKLCH primitives at canonical pairings.

---

## 1. Contrast matrices

### Light mode

| Foreground | Background | Ratio | Normal | Large | Use |
| --- | --- | --- | --- | --- | --- |
| `text-primary` | `background-page` | ~14.8:1 | AAA | AAA | Body |
| `text-primary` | `background-surface` | ~14.2:1 | AAA | AAA | Cards |
| `text-secondary` | `background-page` | ~7.9:1 | AAA | AAA | Sub-copy |
| `text-muted` | `background-page` | ~5.2:1 | AA | AAA | Help (≥12px) |
| `text-subtle` | `background-page` | ~3.9:1 | **Fail** | AA | Decorative only |
| `text-disabled` | `background-page` | ~3.9:1 | **Fail** | AA | Disabled labels (non-informational) |
| `action-primary-fg` on `action-primary` | — | ~5.6:1 | AA | AAA | Primary buttons |
| `action-secondary-fg` on `action-secondary` | — | ~12.1:1 | AAA | AAA | Secondary buttons |
| `action-destructive-fg` on `action-destructive` | — | ~5.4:1 | AA | AAA | Destructive buttons |
| `text-link` on `background-page` | — | ~6.8:1 | AAA | AAA | Inline links |
| `status-success-text` on `status-success-bg` | — | ~5.4:1 | AA | AAA | Badges, alerts |
| `status-warning-text` on `status-warning-bg` | — | ~5.1:1 | AA | AAA | |
| `status-error-text` on `status-error-bg` | — | ~5.7:1 | AA | AAA | |
| `status-info-text` on `status-info-bg` | — | ~6.0:1 | AA | AAA | |
| `status-success-icon` (as text) on `background-page` | — | ~3.6:1 | **Fail** | Pass | Icons only — never body |
| `warning-500` (as text) on `warning-50` | — | ~2.4:1 | **Fail** | **Fail** | Forbidden — use `-text` |

### Dark mode

| Foreground | Background | Ratio | Normal | Large |
| --- | --- | --- | --- | --- |
| `text-primary` (warm-50) | `background-page` (warm-950) | ~16.5:1 | AAA | AAA |
| `text-secondary` (warm-300) | `background-page` | ~9.4:1 | AAA | AAA |
| `text-muted` (warm-400) | `background-page` | ~6.7:1 | AAA | AAA |
| `action-primary-fg` on `action-primary` | — | ~6.1:1 | AAA | AAA |
| `status-*-text` on `status-*-bg` (200/700) | — | ~7.0–8.0:1 | AAA | AAA |

### Pairing safety per surface

| Use | Allowed tokens |
| --- | --- |
| Body text | `text-primary` · `text-secondary` |
| Help, captions (≥12px) | `text-muted` |
| Disabled labels | `text-disabled` (decorative, not informational) |
| Badge text | `status-{status}-text` only |
| Alert text | `status-{status}-text` only |
| Icon glyphs (≥16px) | `status-{status}-icon` |
| Status backgrounds | `status-{status}-bg` |
| Status borders | `status-{status}-border` |
| Solid status fills (e.g. button) | `status-{status}-solid` with `text-inverse` |

---

## 2. Global rules

### Focus
- Always `:focus-visible` (keyboard only) — not `:focus`.
- 2px solid ring of `--color-focus-ring`, 2px outset offset.
- Inputs additionally apply `--shadow-focus` for emphasis without changing layout.
- The ring is olive in light and dark; never red/blue defaults.
- Focus must always be visible — never `outline: none` without a replacement ring.

### Color ≠ status
Every status cue must pair color with at least one of: icon, text label, pattern, or shape.
- Badges: colored dot + text label.
- Form errors: icon + helper text + red border (never red text alone).
- Charts: shape/dash style for colorblind-safe distinction at >2 series.

### Disabled states
- `opacity: 0.5`, `pointer-events: none`, `aria-disabled="true"`.
- Disabled buttons keep readable text (no opacity below 0.4 — fails AA).
- Disabled inputs use `--input-disabled-bg` to differentiate from active surfaces.

### Motion
- Honor `prefers-reduced-motion` — `base.css` reduces all transitions to 0.001ms.
- No auto-playing animation longer than 5s.
- Do not animate `opacity: 0 → 1` on body text content (flicker for dyslexic readers).

### Touch targets
- Minimum **44 × 44 px** at coarse pointers (`@media (pointer: coarse)`); buttons up-size to `--size-button-lg`.
- Inline links inherit line-height; ensure 24px clickable area for adjacent inline links.

---

## 3. Per-component checklist

### Button
- [ ] Min 32px tall (md); 44px on touch devices.
- [ ] `:focus-visible` shows ring; never `outline:none` without replacement.
- [ ] Loading state preserves width and announces via `aria-busy="true"`.
- [ ] Icon-only buttons have `aria-label`; `<button type="button">` unless submitting.
- [ ] Destructive variant pairs color + verb (e.g. "Delete", not just red icon).

### Input · textarea · select
- [ ] Every input has a programmatically associated `<label>` (or `aria-labelledby`).
- [ ] Helper text linked via `aria-describedby`; error text linked via `aria-describedby` AND `aria-invalid="true"`.
- [ ] Placeholder is **not** the label.
- [ ] Required fields marked both visually (`*`) and via `aria-required="true"`.
- [ ] Focus ring uses `--shadow-focus`; error focus uses `--shadow-focus-error`.

### Checkbox · radio · toggle
- [ ] Hit target ≥24px including label.
- [ ] State announced: `role="checkbox"`/`"radio"`/`"switch"` with `aria-checked`.
- [ ] Indeterminate checkbox uses `aria-checked="mixed"`.
- [ ] Toggle includes on/off labels for screen readers; never relies on color alone.

### Tabs
- [ ] `role="tablist"` / `tab` / `tabpanel` with `aria-selected` / `aria-controls`.
- [ ] Arrow keys move focus; Home/End jump to ends; Enter/Space activates.
- [ ] Active tab indicator is a 2px line, not just bold text.

### Table
- [ ] `<th scope="col">` on column headers; `scope="row"` when row label.
- [ ] Sortable columns: `aria-sort="ascending"|"descending"|"none"`; sort glyph visible.
- [ ] Selected rows have a 2px left border + tint (color + shape).
- [ ] Empty state has a heading and an action — not just an icon.

### Modal · dialog
- [ ] `role="dialog"` with `aria-labelledby` (title) and `aria-describedby` (body).
- [ ] Focus moves to first focusable element on open; restored to trigger on close.
- [ ] `Esc` closes; click outside dismisses unless destructive (then explicit cancel only).
- [ ] Background scroll locked; focus trapped within dialog.
- [ ] Overlay reaches AA against page (the scrim handles this).

### Tooltip
- [ ] Hover **and** keyboard focus reveals (`onFocus` not just `onMouseEnter`).
- [ ] `Esc` dismisses; doesn't disappear when the user moves into it.
- [ ] Never the only delivery for critical information — pair with visible label.

### Toast · alert
- [ ] `role="status"` (polite) for non-urgent, `role="alert"` (assertive) for errors.
- [ ] Auto-dismiss ≥5s for >100 chars; pauseable on focus.
- [ ] Includes icon + text; close button has `aria-label="Dismiss"`.

### Dropdown · popover · command
- [ ] `aria-haspopup` + `aria-expanded` on trigger.
- [ ] Arrow keys navigate items; Enter activates; Esc closes.
- [ ] Active item visually distinct (selected tint + bolder text).
- [ ] Returns focus to trigger on close.

### Date picker
- [ ] Grid: `role="grid"`; cells labelled by full date (not just day-of-month).
- [ ] Arrow keys navigate days; PageUp/PageDown for months; Home/End for week.
- [ ] Today indicated with both border and a label like "Today, June 12".
- [ ] Range mode: announce both endpoints in the live region.

### Stepper · pagination · breadcrumb
- [ ] Stepper: `aria-current="step"` on active; completed steps have a checkmark + label.
- [ ] Pagination: `aria-current="page"` on active; arrows have `aria-label="Previous page"` etc.
- [ ] Breadcrumb: `aria-label="Breadcrumb"` on `<nav>`; current page is plain text with `aria-current="page"`.

### File upload
- [ ] Native `<input type="file">` is keyboard-reachable (visually hidden, not `display:none`).
- [ ] Drop zone has descriptive text + click affordance — drag is enhancement, not the only path.
- [ ] Errors announced via live region.

### Charts
- [ ] Max 6 categorical hues; beyond that, group into "Other".
- [ ] Pair color with shape (markers, dash) for colorblind-safe distinction.
- [ ] Tooltip is not the only delivery — provide an accessible data table fallback.
- [ ] Reference and threshold lines labeled inline, not just colored.

### Skeleton · spinner · progress
- [ ] Skeleton: `aria-hidden="true"` plus parent `aria-busy="true"`.
- [ ] Spinner: `role="status"` with `aria-label="Loading"` (not the only feedback for >1s waits — show progress).
- [ ] Determinate progress: `role="progressbar"` with `aria-valuenow/min/max`.

---

## 4. Testing protocol

| Tool | Purpose | When |
| --- | --- | --- |
| Storybook + a11y addon | Per-component WCAG checks | Every PR |
| axe-core CI | Automated full-page audit | Every build |
| VoiceOver / NVDA | Screen-reader smoke | Per release |
| Keyboard-only run | No-mouse navigation | Per release |
| 200% zoom + 320px width | Reflow | Per release |
| Forced-colors mode | Windows High Contrast | Per release |

A component is "done" only when it passes Storybook a11y, keyboard-only, and screen-reader checks.
