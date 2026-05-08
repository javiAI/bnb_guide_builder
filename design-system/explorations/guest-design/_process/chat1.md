# Batch 2 Design Reminders

_Started 2026-05-08 13:21 UTC_

---

## User



## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: set_project_title]_

_[tool: copy_files]_

I'll start Batch 1 — the token sheet. Let me set up the project structure and build the token reference artboard.

_[tool: snip]_

_[tool: write_file]_

Now I'll build the Batch 1 token sheet — a single reference artboard documenting the `--guest-*` token system, dark bindings, contrast ratios, and the type ramp.

**System decisions I'm committing to up front:**
- **Visual character**: warm sand gradient + deep slate accent + amber/clay/moss earthy semantics + Inter (lifted from baseline).
- **Token namespace**: `--guest-color-{role}-{variant}`, `--guest-text-*`, `--guest-space-*`, `--guest-radius-*`, `--guest-elev-*`.
- **Dark binding strategy**: warm near-black stone scale (no cold grey), accent surface stays dark slate (lifted ~10% L), ink ramp inverts.
- **Status colors in dark**: lift L ~25% + drop chroma ~15% so amber/clay/moss stay legibly warm without going neon.

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**Batch 1 delivered.** Token sheet is live at `Batch 1 - Tokens.html` — full `--guest-*` system with light + dark columns, AAA contrast on hero (13.7:1 light, 11.8:1 dark), 8-brand contrast audit (4 keys flagged for `--guest-color-text-on-brand` fix in Batch 5), and the Inter type ramp.

Reply **continue** for Batch 2 (9 mobile screens, 375×667).

## User

continue
# Batch 2 reminders before you start

- Hero accent in Esenciales/Llegada/Salida = slate-700 (system accent),
  exactly like the baseline. NOT coral. Coral only appears as
  per-property flourish (eyebrow dot, chip border, micro accent).
- Where coral surfaces ARE brand-tagged: pre-apply the fg fix you
  flagged in Batch 1 brand stress (do NOT use #FFFFFF text on coral —
  use a tinted off-white that hits 7:1).
- Empty state for `gs.emergency` MUST use exact `emptyCopyGuest` from
  guide_sections.json: "Si necesitas ayuda durante la estancia,
  contacta con tu anfitrión." Render that as a neutral message — no
  imperative "añade", "configura".
- Each section's title and items sourced from taxonomy IDs. Caption
  each artboard with the source file path.

## Assistant

_[tool: snip]_

_[tool: write_file]_

Building Batch 2 — 9 mobile screens at 375×667, with full Spanish content from the sample property and taxonomy IDs captioned.

_[tool: done]_

_[tool: fork_verifier_agent]_

_[tool: snip]_

**Batch 2 delivered.** 9 mobile screens at 375×667, light, in `Batch 2 - Mobile.html`.

- **Hero accent:** slate-700 on Esenciales/Llegada/Salida — coral only as eyebrow dot, chip border, and a single per-property pill on Salida's "vie 11:00" handoff card.
- **Coral fg fix pre-applied:** `--guest-brand-fg: #2A0808` (dark coral) on `--guest-brand-50` surface = 9.6:1. Used on the rec pill ("Recomendado") and the Salida brand pill.
- **Empty state:** `gs.emergency` carries the exact `emptyCopyGuest` string verbatim, neutral framing, no imperative.
- **Captions:** every artboard names the source taxonomy file(s) — `guide_sections.json`, `space_types.json`, `system_taxonomy.json`, `policy_taxonomy.json`, `local_place_categories.json`, `escalation_rules.json`, etc.

Reply **continue** for Batch 3 (desktop/tablet, same 9 sections).

## User

# Fix Batch 2 before Batch 3 — three corrections

You will RE-EMIT all 9 mobile artboards from Batch 2 with these
corrections. Same layout, same content sourcing, same Direction.
Only these surgical fixes:

1. **Strip ALL taxonomy ID prefixes from visible on-screen text.**
   Taxonomy IDs (`am.*`, `sp.*`, `sys.*`, `sub.*`, `rm.*`, `lpc.*`,
   `lec.*`, `les.*`, `ct.*`, `ic.*`, `esc.*`) must appear ONLY in the
   source caption below the phone — NEVER inside the screen content.
   Replace each occurrence with the human Spanish label only.

   Examples of fixes:
   - "sp.bedroom_main · balcón a Calle Cuba" → "Balcón a Calle Cuba"
   - "sys.climate · sub.split · mando azul" → "Mando azul en la mesa"
   - "ct.host · responde < 1 h · es-ES y EN" → "Responde en menos de 1 h · es-ES y EN"
   - "ic.medical · ic.fire · ic.security" → "Médico · bomberos · seguridad"
   - "esc.no_response_60min — si Javier..." → "Si Javier no responde en 60 min..."
   - "lpc.market · fruta, pan, pescado" → "Fruta, pan, pescado"

   This applies to body text, sub-labels, eyebrows, list-card
   subtitles — everywhere INSIDE the phone frame. The captions BELOW
   the phone keep the IDs (that's documentation, not UI).

2. **Remove the `.empty` block from screens 06 (Normas) and 09
   (Emergencias).** Both screens have populated items. Empty states
   appear IN PLACE OF items when none exist, not appended to them.
   Keep the populated rules cards / contact rows; delete the trailing
   `.empty` block on those two screens only.

3. **Touch target floors:**
   - `.chip` → `min-height: 36px` (visual) with implicit slop to
     44px hit area, OR direct `min-height: 44px`. Pick one and apply
     to ALL filter chips (Local screen, plus future chips).
   - `.emg-call` → `min-height: 44px` directly. These are emergency
     buttons; no slop tolerated.

Re-emit ALL 9 frames. Do not skip any. Output the same artboard
order.

## Assistant

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

**Batch 2 corrections applied.** All taxonomy IDs stripped from in-phone text (kept in source captions below). `.empty` blocks removed from screens 06 and 09. `.chip` and `.emg-call` both bumped to `min-height: 44px`.

Reply **continue** for Batch 3 (desktop/tablet, same 9 sections).

## User

continue

## Assistant

_[tool: snip]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

_[tool: snip]_

**Batch 3 delivered.** 9 desktop frames at 1280×800 in `Batch 3 - Desktop.html` — persistent 240px sidebar with all 9 sections, contextual top bar with breadcrumb + quick essentials pills, main content adapted to the wider canvas:

- **01 Esenciales** — hero strip with 4 metrics, 2-col split for access + Wi-Fi, primary actions next to local recs
- **02 Llegada** — 5-step trip timeline beside the lockbox visual + 3-step entry list
- **03 Espacios** — 2×2 grid of space cards, 3-thumb strips per card
- **04 Cómo usar** — master/detail: 5-system list left, full Mitsubishi climate detail right with troubleshooting band
- **05 Equipamiento** — Wi-Fi card on top, then 3 columns: Recomendado / Cocina / Confort
- **06 Normas** — 2×2 rule grid with 2 amber sanción cards, vecinos + eventos especiales below
- **07 Salida** — 3 horizontal timeline cards (noche / mañana / entrega)
- **08 Guía local** — 580px map with multi-pin neighborhood + chips/places/events column
- **09 Ayuda** — 3 contact cards (host / 112 / turística) + 4-step escalation diagram

Slate-700 hero accent throughout, coral as eyebrow dot only, brand-fg fix applied to coral surfaces. Every artboard caption names the source taxonomy file(s).

Reply **continue** for Batch 4.

## User

continue

## Assistant

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

Now let me ship and verify.

_[tool: snip]_

_[tool: fork_verifier_agent]_

**Batch 4 delivered.** 4 host-editor frames at 1280×800 in `Batch 4 - Editor.html`:

- **01 Workspace** — 9-card status grid with `gs.*` ids, completion bars, slot/photo/SLA stats per section
- **02 Editor · Esenciales** — sections rail (left) · form with `welcome.*`, `essentials.quickActionSlots` slot picker bound to `quick_actions.json`, and `amenity.wifi` fields · live mobile preview (right)
- **03 Editor · Llegada** — `access_methods.json` picker locked to `am.lockbox` with code/location fields, lockbox renderer preview, photo upload, multi-select for `building_access_methods.json`
- **04 Publish** — readiness pass (12 ok / 4 warn / 0 fail), empty-state lock bound to `gs.emergency.emptyCopyGuest`, 8-key brand stress with the FIX badges flagged in Batch 1, publish bar at the bottom

Reply **continue** for Batch 5 (the brand-fg fix that closes the loop on Batch 1's audit).

## User



## Assistant

_[tool: snip]_

_[tool: delete_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**Batch 4 re-emitted** as 5 guest-side mobile overlays in `Batch 4 - Mobile overlays.html` — TOC drawer, search overlay (focus-visible on the input), lightbox 2/5, PWA install nudge, and language switcher. Inherits Batch 2's iPhone shell, slate-700 hero, coral flourish, and tab bar. All targets ≥44px, body ≥16px, taxonomy IDs only in captions.

Reply **continue** for Batch 5.

## User

continue

## Assistant

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

_[tool: fork_verifier_agent]_

**Batch 5 of 5 delivered.** `Batch 5 - Brand FG repair.html` closes the loop on Batch 1's contrast audit — 8 brand keys, 16 new tokens (`--guest-on-solid-{brand}` + `--guest-on-tint-{brand}`), all pairs ≥ 7:1 AAA, drop-in CSS at the top.

The 5-batch sequence is complete:
1. Tokens
2. Mobile (9 screens)
3. Desktop/tablet
4. Mobile overlays
5. Brand FG repair

## User



## Assistant

_[tool: snip]_

_[tool: copy_files]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

**Batch 5 (re-emit) delivered.** `Batch 5 - Dark parity + brand stress.html` — 6 rendered frames:

- **01–04** mobile dark 375×667 (Esenciales, Llegada, Salida, Emergencias) consuming `--guest-on-solid-coral-d` / `--guest-on-tint-coral-d` over `#0E0D0B → #1A1814 → #25221C → #2E2A23` surface ladder
- **05** desktop dark 1280×800 (rail · main · aside) with same content as #01
- **06** brand stress strip — coral/indigo/sienna light + sienna dark hero, all ≥7.6 : 1 AAA

Old token-only audit preserved at `Batch 5 - Brand FG repair (audit, superseded).html`.

## User

Verifier agent check completed

## Assistant

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

Phone grid fixed to 2×2 — both edge phones now contained. File clean.

## User



## Assistant

_[tool: snip]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

_[tool: fork_verifier_agent]_

**Batch 6 (cierre) delivered.** Two artifacts:

- **`colors_and_type.css`** — production token sheet replacing the placeholder. ~530 lines: stone/slate/status primitives, full `--guest-color-*` semantic ramp (light + dark), 32 doublet tokens (8 brands × 4 light) + 32 dark equivalents, brand-aware mappings via `[data-brand]` × 8 + `[data-theme="dark"][data-brand]` × 8, type ramp helpers, focus-visible, reduced-motion.
- **`Batch 6 - Brand stress matrix.html`** — 4 × 4 matrix, 16 heroes consuming the doublet via `[data-brand]` (and dark cells via `[data-theme="dark"][data-brand]`). All 16 ratios annotated, ≥ 7.2 : 1 AAA.

The 6-batch cycle is closed: tokens → mobile → desktop → editor → dark parity → consolidation.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

_[tool: snip]_

Compound selector swapped to descendant form (`[data-theme="dark"] [data-brand="<key>"]`) — dark cells now resolve to `-d` variant tokens. Verifier re-checking.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

Verified clean. Batch 6 closed — `colors_and_type.css` + `Batch 6 - Brand stress matrix.html` both passing.

## User



## Assistant

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

_[tool: snip]_

**Batch 6b delivered.** `Batch 6b - Tint stress matrix.html` — gemelo de Batch 6 con la rama tint del doublet (16 info-cards, ratios 9.6 – 12.4 : 1 AAA).Turn ended.

