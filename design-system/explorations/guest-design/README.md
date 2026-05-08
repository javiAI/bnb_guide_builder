# Guest design — sistema visual definitivo de la guía del huésped

Bundle producido en Claude Design (claude.ai/design) en mayo 2026.
**Es la fuente única y final para `audience=guest`** — no hay alternativas
en activo. Cualquier identidad visual previa para el huésped queda
superada por este bundle.

## Cómo usarlo

El bundle tiene tres roles distintos. No mezclarlos:

1. **`tokens/colors_and_type.css`** — fuente literal de los `--guest-*`.
   Se factoriza al `design-system/foundations/tokens/` del repo durante
   la implementación de `feat/liora-guest-visual-redesign-16H` en tres
   archivos (`guest-primitives.css`, `guest-semantic.css`,
   `guest-brand.css`). NO se importa tal cual en producción.
2. **`frames/*.html`** — ground truth visual de layout, ritmo,
   jerarquía, microcopy, anatomía de cards/overlays. Se leen
   visualmente en navegador (`open frames/02-mobile.html`) y se
   replican en React. NO se sirven en producción.
3. **`DESIGN.md`** — spec canónico de las 9 secciones. Referencia
   normativa para la PR de implementación.

## Estructura

```
guest-design/
├── README.md                         este archivo
├── DESIGN.md                         spec canónico (9 secciones)
├── tokens/
│   └── colors_and_type.css           CSS canónico — doublet API completo,
│                                     8 brands × light/dark, todos los
│                                     pares ≥ 7:1 AAA
├── frames/                           ground truth visual ordenado
│   ├── 01-tokens.html                token sheet (light + dark, 8-brand audit)
│   ├── 02-mobile.html                9 mobile screens 375×667 light
│   ├── 03-desktop.html               9 desktop frames 1280×800 light
│   ├── 04-mobile-overlays.html       TOC, search, lightbox, PWA, lang switcher
│   ├── 05-dark-parity.html           4 mobile dark + 1 desktop dark + brand stress strip
│   ├── 06-brand-stress-solid.html    4×4 = 16 hero variants (8 brands × 2 themes), solid
│   ├── 06b-brand-stress-tint.html    4×4 = 16 tint card variants, gemelo de 06
│   └── 07-components.html            Button / Input / Badge / Toast — todos los estados,
│                                     light + dark
└── _process/                         trazabilidad — no se usa para implementar
    ├── chat1.md                      transcript completo de la sesión Claude Design
    ├── batch5-fg-repair-superseded.html
    └── baseline/
        ├── baseline-index.html       input original (kit liora-guest)
        └── baseline-tokens.css       input original (paleta arrancada al inicio)
```

## Decisiones lockeadas

- **Independencia visual del operator**: `--guest-*` prefijado, coexiste
  con `--color-*` operator sin colisión.
- **Doublet API por brand**: `--guest-on-solid-{key}` (texto sobre `-800`)
  + `--guest-on-tint-{key}` (texto sobre `-50`). Mismas variantes en dark
  con sufijo `-d`.
- **Activación**: `[data-brand="<key>"]` wrapper para mappings light;
  `[data-theme="dark"][data-brand="<key>"]` descendant-form para dark.
- **Theme**: `[data-theme="dark"]` en `<html>` flip global.
- **Sample property**: Casa Lavanda · Calle Cuba 42, 3B · Ruzafa ·
  Anfitriona Laura. es-ES único.
- **WCAG**: AAA 7:1 para hero text en las 64 combinaciones brand × theme.
  AA 4.5:1 mínimo para body.
- **Targets**: ≥ 44 hit area en todo elemento clickable. Sm 32 visual con
  slop declarado vía pseudo-elemento.

## Implementación

La rama `feat/liora-guest-visual-redesign-16H` consume este bundle como
ground truth. Estrategia: **clean rewrite** completo de
`src/components/public-guide/` y `src/app/g/[slug]/`. Spec del flujo de
8 commits en `docs/MASTER_PLAN_V2.md` § FASE 16H.
