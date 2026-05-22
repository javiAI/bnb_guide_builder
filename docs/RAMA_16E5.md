# Plan — Rama posterior a 16E.5 access/
# feat/operator-shell-layout-standardization

## Contexto

Después de cerrar la rama actual de `access/` / llegada y check-in, abriremos una rama nueva enfocada en estandarizar el layout global del operador.

Esta rama NO debe tocar lógica de negocio, Prisma, server actions, schemas, taxonomies ni comportamiento funcional de los módulos. Su objetivo es la arquitectura visual/layout común del operator shell.

Problema actual:
- El área central no aprovecha bien el ancho disponible en pantallas grandes.
- El ancho/contenedor interior varía entre pestañas.
- Los menús laterales no se comportan de forma suficientemente consistente entre secciones.
- El menú izquierdo debería poder colapsarse manualmente como hamburguesa.
- El menú derecho debería poder colapsarse en una pestaña lateral.
- Queremos poder redimensionar ambos menús laterales dentro de límites razonables.
- El header inicial de cada pantalla — título, subtítulo, chips y separador — debería permanecer fijo/sticky durante el scroll, de forma consistente en todas las pestañas.

## Objetivo de la rama

Crear una base de layout común para todas las pestañas del operador:

1. Menú izquierdo estable:
   - mismo contenido y comportamiento en todas las pestañas;
   - tamaño consistente;
   - colapsable manualmente a modo hamburguesa;
   - posiblemente redimensionable con drag dentro de límites.

2. Menú derecho estable:
   - mismo tamaño base en todas las pestañas;
   - contenido posiblemente contextual por pestaña;
   - colapsable manualmente;
   - al colapsar, queda como una pestaña/handle lateral visible en el centro vertical del lado derecho;
   - reabrible desde esa pestaña;
   - posiblemente redimensionable con drag dentro de límites.

3. Contenedor central común:
   - mismo ancho y comportamiento en todas las pestañas;
   - aprovecha mejor pantallas grandes;
   - no crece hasta infinito: max-width amplio pero controlado;
   - consistente entre access, spaces, amenities, systems, troubleshooting, etc.;
   - no más `max-w-*` arbitrarios por página salvo excepción documentada.

4. Header sticky común:
   - la parte superior de cada pantalla operator debe usar un patrón común:
     - eyebrow/contexto;
     - título;
     - subtítulo;
     - chips principales;
     - acciones si aplica;
     - separador;
   - este bloque debe quedarse sticky/fijo al hacer scroll;
   - debe aplicar a todas las pestañas operator de forma consistente;
   - debe respetar dark mode, tokens semánticos y Liora.

## Nombre de rama sugerido

`feat/operator-shell-layout-standardization`

Alternativas:
- `refactor/operator-shell-layout-foundation`
- `feat/liora-operator-layout-standardization`
- `refactor/liora-operator-shell-grid`

Recomendación: `feat/operator-shell-layout-standardization`

## Scope permitido

### Layout shell

Revisar y modificar, si aplica:

- `src/app/properties/[propertyId]/layout.tsx`
- componentes de layout operator:
  - sidebar / sidenav
  - topbar
  - right rail / publishing rail / contextual rail
  - content wrapper
  - page header wrapper
- componentes compartidos de layout:
  - `PageHeader`
  - `PageHeaderChip`
  - `NumberedSection` solo si el layout central lo requiere
- CSS/tokens necesarios para layout:
  - variables de anchura;
  - sticky offsets;
  - z-index;
  - resize handles;
  - responsive behavior.

### Estado UI local

Permitido:
- `localStorage` para persistir:
  - ancho del rail izquierdo;
  - ancho del rail derecho;
  - collapsed state izquierdo;
  - collapsed state derecho.
- fallback seguro si valores corruptos.
- no server persistence.

### Interacción

Permitido:
- botón collapse/expand del menú izquierdo;
- botón collapse/expand del menú derecho;
- tab lateral para reabrir menú derecho;
- drag handles con límites min/max;
- keyboard/a11y básica para los handles.

## Fuera de scope

No tocar:

- Prisma/schema;
- server actions;
- APIs públicas;
- taxonomies;
- registries;
- conditional engine;
- config-driven behavior;
- data fetching de cada módulo salvo que sea estrictamente necesario para layout;
- lógica funcional de access/spaces/amenities/systems/troubleshooting;
- visual parity específica de cada módulo;
- contenido de guest guide `/g/[slug]`.

No rediseñar cada pestaña individualmente. Esta rama crea el **marco común**.

## Diseño esperado

### Layout general

Usar una estructura conceptual:

```css
operator-shell:
  left-rail | main-content | right-rail

Con variables:

--operator-left-rail-width
--operator-right-rail-width
--operator-content-max-width
--operator-shell-gap

Comportamiento:

left rail abierto: ancho default aprox 280px;
left rail colapsado: aprox 64px;
right rail abierto: ancho default aprox 320px;
right rail colapsado: 0px + tab lateral visible;
content: minmax(0, 1fr);
inner content: width: 100%, max-width amplio controlado.

Valores iniciales sugeridos:

left rail:
- default: 280px
- min: 220px
- max: 360px
- collapsed: 64px

right rail:
- default: 320px
- min: 260px
- max: 420px
- collapsed: 0px

content:
- default max-width: 1440px
- posible max-width wide: 1600px
- padding horizontal: 24px / 32px según breakpoint

Estos valores son hipótesis iniciales. Deben validarse visualmente.

Menú izquierdo

Requisitos:

contenido igual en todas las pestañas operator;
tamaño igual en todas las pestañas;
collapse manual a hamburguesa;
en collapsed:
icon rail o hamburger mode;
navegación sigue accesible;
tooltips o labels accesibles;
resize manual opcional con drag handle;
persistencia en localStorage;
límites min/max;
comportamiento responsive no debe romper mobile existente.

A11y:

botón con aria-label;
estado aria-expanded;
drag handle con role="separator" si se implementa resize;
keyboard fallback o al menos botones discretos para expand/collapse.
Menú derecho

Requisitos:

tamaño base igual en todas las pestañas;
contenido puede ser contextual por pestaña;
colapsable manualmente;
al colapsar:
no desaparece sin affordance;
queda una pestaña/handle lateral visible en el borde derecho;
preferentemente centrada verticalmente;
click en pestaña reabre el rail;
resize manual opcional con drag handle;
persistencia en localStorage;
límites min/max.

Preguntas a resolver en Fase -1:

¿El contenido del right rail será común o contextual?
¿Qué páginas tienen right rail real hoy?
¿Qué hacemos en páginas sin right rail?
opción A: rail vacío/oculto;
opción B: tab contextual solo si hay contenido;
opción C: rail estándar con contenido de ayuda/estado.
¿La pestaña derecha muestra icono, texto rotado, o ambos?

Recomendación inicial:

mantener tamaño/comportamiento común;
permitir contenido contextual por pestaña;
si una página no tiene contenido derecho, el rail puede estar ausente, pero el main content conserva reglas de ancho comunes.
Contenedor central

Problema a resolver:

páginas actuales usan distintos max-w-*, provocando sensación de anchura inconsistente.
en pantallas grandes queda espacio muerto entre menús.

Requisitos:

crear wrapper común para páginas operator;
mismo ancho máximo para todas;
más ancho que el actual;
no infinito;
todas las pestañas deben usar el mismo patrón.

Propuesta:

crear OperatorContentFrame o similar;
incluir:
sticky page header slot;
scroll container;
content body;
sustituir wrappers por página gradualmente o en esta rama si es seguro.

Ejemplo conceptual:

<OperatorShell>
  <LeftRail />
  <OperatorMain>
    <OperatorStickyPageHeader>
      <PageHeader ... />
    </OperatorStickyPageHeader>
    <OperatorContentFrame>
      {children}
    </OperatorContentFrame>
  </OperatorMain>
  <RightRail />
</OperatorShell>
Header sticky común

Nuevo patrón obligatorio:

La parte inicial de cada pantalla operator debe quedar fija/sticky al hacer scroll:

eyebrow/contexto;
título;
subtítulo;
chips;
acciones;
separador inferior.

Ejemplo en access:

"Propiedad · Llegada"
"Llegada y acceso"
"La hora más frágil de toda la estancia..."
chips: check-in, check-out, entrada autónoma, edificio cerrado
separator

Requisitos:

sticky dentro del scroll container correcto;
top debe considerar topbar si existe;
background sólido/elevated para evitar transparencia;
border-bottom o separator;
z-index consistente;
dark mode correcto;
no tapar contenido al hacer scroll;
no duplicar headers por página.

Preguntas a resolver en Fase -1:

¿El sticky header se implementa en PageHeader directamente o en wrapper OperatorStickyPageHeader?
¿Todas las páginas tienen ya PageHeader?
¿Cómo migrar páginas que aún no usan PageHeader?
¿Qué pasa en formularios largos con acciones sticky propias?

Recomendación:

no meter sticky behavior dentro de PageHeader puro;
crear wrapper OperatorStickyHeader o OperatorPageChrome;
PageHeader sigue siendo presentational;
sticky es responsabilidad del layout/shell.
Responsive

Breakpoints sugeridos:

Mobile
left rail: hamburguesa/drawer;
right rail: oculto o tab;
content: full width;
sticky header compactado.
Tablet
left rail puede estar collapsed por default;
right rail puede estar collapsed por default;
content aprovecha ancho.
Desktop
left rail open por default;
right rail open si la página tiene contenido contextual;
content max-width amplio.
Wide desktop
permitir 4-column cockpit en access;
content max-width aprox 1440–1600;
rails mantienen tamaños persistidos.
Persistencia

Usar localStorage keys namespaced:

operatorShell.leftRail.width
operatorShell.leftRail.collapsed
operatorShell.rightRail.width
operatorShell.rightRail.collapsed

Validar:

parse seguro;
clamp a min/max;
fallback a defaults;
no acceso a localStorage fuera de client/effect;
SSR-safe.
Testing / verification
Skills obligatorias

Usar:

frontend-design
antes de definir visual/layout final;
comparar alternativas de rail + sticky header;
evaluar density y hierarchy.
webapp-testing
para resize/collapse;
screenshots responsive;
navegación entre tabs;
sticky header scroll.
liora-ui-kit-parity
solo si se toca una página concreta con kit-ref;
para shell/layout usar referencias del operator shell de Liora si existen:
design-system/references/liora-ui-kits/ui_kits/operator/index.html
operator.css
Manual / Playwright smoke

Cubrir al menos:

Desktop normal:
left rail abierto;
right rail abierto;
content ancho común.
Desktop wide:
content usa más espacio;
access cockpit puede verse 4×1 si cabe.
Resize left rail:
drag dentro de límites;
reload persiste.
Resize right rail:
drag dentro de límites;
reload persiste.
Collapse left rail:
queda hamburger/icon mode;
navegación sigue usable;
reload persiste.
Collapse right rail:
rail desaparece;
tab lateral visible;
click reabre;
reload persiste.
Scroll en página larga:
header inicial queda sticky;
chips y separador visibles;
no tapa contenido.
Cambiar entre tabs:
ancho central consistente;
rails no saltan;
header sticky consistente.
Dark mode:
rails;
sticky header;
separators;
drag handles;
right tab.
Mobile:
comportamiento actual no se rompe;
no overflow horizontal.
Tests candidatos
Test localStorage guard:
valores corruptos vuelven a defaults;
valores fuera de rango se clamp.
Test static:
páginas operator migradas usan wrapper común.
Test a11y:
resize handles tienen aria-label / role separator.
collapse buttons tienen aria-expanded.
Playwright:
collapse/expand rails;
sticky header visible tras scroll;
no horizontal overflow.
Riesgos
Resize manual puede ser demasiado costoso/a11y-sensitive.
Mitigación: implementar primero collapse/expand + defaults; resize si no complica demasiado.
O hacer resize con mouse first + keyboard follow-up.
Sticky header puede tapar contenido.
Mitigación: scroll padding / layout offset / test con páginas largas.
Right rail contextual puede variar por página.
Mitigación: estandarizar tamaño/comportamiento, no contenido.
Cambiar wrappers puede tocar muchas páginas.
Mitigación: crear wrapper común y migrar solo operator pages necesarias.
No tocar guest guide.
LocalStorage SSR issues.
Mitigación: solo client components / effects / guarded reads.
Scope creep hacia rediseñar todas las páginas.
Mitigación: esta rama solo shell layout, no contenido de módulos.
Fase -1 esperada

Antes de implementar, el agente debe leer:

docs/MASTER_PLAN_V2.md secciones Fase 16 / operator shell / Liora governance.
CLAUDE.md patrones Liora 16D.5.
layout actual:
src/app/properties/[propertyId]/layout.tsx
componentes de layout en src/components/layout/
usos de PageHeader
páginas con right rail actual.

Debe producir:

Resumen técnico.
Resumen conceptual.
Ambigüedades.
Alternativas.
Recomendación.
Propuesta de branch name.
Lista exacta de archivos candidatos.
Plan de validación screenshots/tests.

No crear rama ni tocar código hasta aprobación explícita.

Decisión inicial recomendada

Primero implementar:

layout común;
collapse left rail;
collapse right rail;
sticky header;
content width común.

Luego decidir si meter resize manual en la misma rama o dejarlo como subfase 2 dentro de la misma PR.

Mi preferencia:

collapse + sticky + width común = obligatorio;
resize manual = intentar si no dispara complejidad; si complica, diferir documentado.
Prompt de kickoff para la futura rama

Pegar al iniciar la rama:

Vamos a arrancar una nueva rama posterior a 16E.5 access: `feat/operator-shell-layout-standardization`.

Objetivo:
Estandarizar el operator shell layout en todas las pestañas:
- left rail consistente, colapsable tipo hamburguesa;
- right rail consistente en tamaño, colapsable como pestaña lateral;
- posible resize manual con límites;
- content container central común y más ancho;
- sticky page header común para title/subtitle/chips/actions/separator;
- comportamiento uniforme entre tabs operator.

Sigue protocolo:
1. No toques código.
2. Lee primero:
   - `docs/MASTER_PLAN_V2.md` Fase 16 / operator shell / Liora governance
   - `CLAUDE.md`
   - layout actual: `src/app/properties/[propertyId]/layout.tsx`
   - componentes en `src/components/layout/`
   - uso actual de `PageHeader`
3. Ejecuta Fase -1:
   - Resumen técnico
   - Resumen conceptual
   - Ambigüedades
   - Alternativas
   - Recomendación
   - archivos candidatos
   - plan de validación
4. No crear rama ni modificar archivos hasta aprobación explícita.

Restricciones:
- No Prisma/schema.
- No server actions.
- No taxonomies.
- No config-driven behavior.
- No guest guide.
- No rediseñar contenido interno de módulos.
- Solo shell/layout/chrome operator.

Puntos clave:
- left rail: mismo contenido/tamaño en todas las tabs, collapse manual a hamburguesa, posible resize.
- right rail: mismo tamaño base, contenido contextual permitido, collapse a tab lateral central, posible resize.
- content: ancho común, más amplio en desktop/wide, max-width controlado.
- sticky page header: title/subtitle/chips/actions/separator fijo durante scroll.
- mobile/tablet/desktop/wide deben funcionar.

Usar skills:
- `frontend-design`
- `webapp-testing`
- `liora-ui-kit-parity` si se usa referencia shell Liora.

No implementar resize manual si dispara complejidad excesiva; documentarlo como subfase/follow-up si hace falta.