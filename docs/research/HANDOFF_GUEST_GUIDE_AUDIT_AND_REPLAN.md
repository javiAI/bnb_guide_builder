# Handoff — Guest Guide Audit, UX Review, and Replan

**Version:** `1.0`  
**Date:** `2026-04-17`  
**Scope:** auditoría del estado actual de la Guest Guide implementada hasta `10E`, comparación contra la investigación profunda, identificación de gaps críticos, recomendaciones de UX/UI y propuesta de nueva rama prioritaria para cerrar el boundary guest.

---

## 1. Resumen ejecutivo

La implementación actual de la guía tiene una **base arquitectónica muy buena** pero todavía **no aplica correctamente la investigación profunda en la capa más importante: la traducción de datos internos a una experiencia operativa, humana y premium para el huésped**.

### Veredicto
- **Arquitectura / extensibilidad / config-driven:** muy bien
- **Modelo GuideTree / taxonomías / media / audience:** muy bien
- **Renderer público como sistema:** bien encaminado
- **Experiencia guest real:** todavía insuficiente
- **Alineación con benchmarks top (Touch Stay / Hostfully / Enso):** parcial
- **Estado actual global:** producto serio a nivel técnico, todavía no “top mundial” a nivel UX final

### Problema principal
El renderer actual **muestra datos correctamente**, pero **no los presenta con semántica de huésped**.

Esto se ve en el output actual:
- JSON crudo visible en guest/internal
- enums internos visibles (`designated_area`, `not_allowed`, etc.)
- políticas complejas no resumidas
- empty states escritos en lenguaje de editor/CMS
- duplicación visual entre `Esenciales` y `Llegada`
- falta de quick actions críticas
- jerarquía visual insuficiente para urgencia real del huésped

---

## 2. Estado actual observado

### Inputs revisados
- capturas completas de la guía pública de arriba abajo
- markdown renderizado actual
- JSON completo del `GuideTree`
- PDF exportado de la guía

### Hechos observados
La guía actual contiene:
- `Esenciales`
- `Llegada`
- `Espacios`
- `Cómo usar`
- `Equipamiento`
- `Normas de la casa`
- `Salida`
- `Guía local`
- `Ayuda y emergencias`

Hay una base correcta de:
- TOC lateral
- cards
- secciones ordenadas
- espacio limpio
- media por entidad
- renderer razonable

### Problemas observados en output
Se están mostrando valores como:
- `{"to":"08:00","from":"00:00","enabled":true}`
- `designated_area`
- `{"policy":"small_gatherings","maxPeople":6}`
- `{"allowed":false}`
- blobs JSON completos de mascotas
- labels técnicas como `ct.host`
- empty states tipo “Añade notas de uso o runbooks...”

Esto **no es aceptable** para audience=`guest`.

---

## 3. Qué está correcto

### 3.1 Arquitectura
- `GuideTree` tipado: correcto
- secciones config-driven: correcto
- renderers separados: correcto
- `guide_sections.json`: correcta dirección
- `visibility` model: correcto
- `sensitive` fuera del tree público: correcto
- media proxy / variants: buena dirección
- enfoque registry-driven: correcto
- evitar hardcoded IDs: muy bien
- stack general: sólido

### 3.2 Orden base de información
La IA general de la guía va razonablemente bien:
- llegada primero
- estancia después
- salida al final
- ayuda y emergencias separada
- espacios y equipamiento como bloques distintos

### 3.3 Visualmente
- diseño limpio
- sin ruido
- base minimalista correcta
- cards como patrón base razonable
- navegación lateral desktop útil

---

## 4. Qué NO está correcto

### 4.1 Problema principal — falta de “guest presentation layer”
El sistema compone el árbol, pero **no cierra el boundary entre dato estructurado y copy final para huésped**.

#### Síntomas
- JSON crudo en guest
- enums crudos en guest
- placeholders editoriales en guest
- labels internas visibles
- policies complejas sin resumir
- fees false mostrados como JSON
- contactos con valores técnicos

#### Conclusión
Hace falta una fase explícita:

```ts
composeGuide(...)
→ filterByAudience(...)
→ normalizeGuideForPresentation(tree, audience, locale)
→ render
```

---

### 4.2 “Esenciales” está mal resuelto UXmente
`gs.essentials` hoy funciona más como **aggregator técnico** que como **panel operativo real**.

#### Problemas
- se parece demasiado a una sección normal
- duplica visualmente contenido de `Llegada`
- incluye items que no son críticos para el hero
- no actúa como panel de supervivencia

#### Ejemplo actual de contenido inadecuado en hero
- Check-in
- Cerradura inteligente
- Horario de silencio
- Fumar / vapear
- Mascotas

Eso no es el mix correcto para un hero guest-first.

#### Lo correcto
El bloque superior debe priorizar:
- cómo entrar
- WiFi
- parking
- ayuda/contacto
- quizá check-out / dirección

No:
- fumar
- mascotas
- horario de silencio

---

### 4.3 Falta de quick actions y reducción de fricción
No se observa todavía un panel con:
- copiar WiFi
- abrir Maps
- llamar
- WhatsApp
- copiar código
- ir a ayuda

Esto es una carencia crítica respecto a la investigación.

---

### 4.4 Empty states aún escritos para host/editor
Ejemplo incorrecto:
- “Añade notas de uso o runbooks...”

Esto no debe llegar nunca a audience=`guest`.

#### Regla
Para guest:
- o se oculta la sección vacía
- o se muestra una frase útil para el huésped
- nunca copy editorial

---

### 4.5 Jerarquía visual insuficiente
Todo pesa demasiado parecido:
- mismas cards
- mismo tono
- urgencia mal expresada
- poca diferenciación entre critical info y secondary info

---

### 4.6 Espacios todavía demasiado “inventarial”
Ahora mismo `Espacios` funciona como ficha básica, pero no responde suficientemente a:
- qué hay aquí
- qué se puede usar
- qué conviene saber
- qué destaca

---

### 4.7 Guía todavía demasiado “renderer correcto” y no “producto premium”
La guía actual se percibe como:
- limpia
- ordenada
- técnica
- correcta

Pero todavía no como:
- herramienta operativa premium
- producto hospitality top-tier
- experiencia claramente superior a la competencia

---

## 5. Qué es prioritario

## Prioridad absoluta
### A. Cerrar la capa de presentación guest
Sin esto, cualquier mejora visual queda encima de una base semánticamente incorrecta.

### B. Implementar hero con quick actions reales
Esto es el principal gap funcional visible.

### C. Humanizar todas las policies complejas
La guía debe hablar lenguaje de huésped, no lenguaje de schema.

### D. Eliminar copy editorial del output público
Nunca mostrar lenguaje de CMS al huésped.

### E. Diferenciar mejor niveles de card / jerarquía visual
El huésped debe entender urgencia de un vistazo.

---

## 6. Repriorización recomendada del roadmap

### No seguir el roadmap de forma ciega
Antes de seguir ampliando features, conviene cerrar una rama nueva:

## Nueva rama recomendada
`fix/guest-presentation-layer`

### Orden recomendado real
1. `fix/guest-presentation-layer`
2. `10F — feat/guide-hero-quick-actions`
3. Pulido visual fuerte sobre `10E`
4. `10G — feat/guide-client-search`
5. `10H — feat/guide-pwa-offline`
6. `13D — feat/guide-issue-reporting`
7. bloque IA / assistant / search semántica posterior

---

## 7. Nueva rama propuesta

# Rama — `fix/guest-presentation-layer`

## Propósito
Cerrar de forma dura el boundary entre:
- datos canónicos / estructurados / internos
- y copy final para audience=`guest`

Objetivo real:
- ningún huésped vuelve a ver JSON, enums internos, placeholders editoriales ni labels técnicas

---

### 7.1 Cambios funcionales esperados

#### Guest no debe ver nunca
- JSON crudo
- snake_case enums
- valores serializados
- labels internas
- warnings técnicos
- `deprecated_*`
- copy editorial (“añade/configura/runbook…”)
- roles como `ct.host`

#### Guest debe ver siempre
- copy humana
- frases accionables
- reglas resumidas
- campos complejos convertidos a texto o bullets
- fallback elegante si no hay presenter específico

---

### 7.2 Diseño del pipeline

#### Estado actual conceptual
```ts
composeGuide(...)
→ filterByAudience(...)
→ render
```

#### Estado objetivo
```ts
composeGuide(...)
→ filterByAudience(...)
→ normalizeGuideForPresentation(tree, audience, locale)
→ render
```

---

### 7.3 Archivos a crear

#### `src/lib/services/guide-presentation.service.ts`
Responsable de transformar el `GuideTree` para presentación.

Funciones:
- `normalizeGuideForPresentation(tree, audience, locale): GuideTree`
- `normalizeSectionForPresentation(section, audience, locale): GuideSection | null`
- `normalizeItemForPresentation(item, audience, locale): GuideItem | null`
- `presentGuideValue(item, audience, locale): PresentedValue`
- `shouldHideEmptySectionForAudience(section, audience): boolean`

#### `src/lib/services/guide-presenters/policy-presenter.ts`
Presentación semántica de policies.

Funciones sugeridas:
- `presentQuietHours(value, locale)`
- `presentSmokingPolicy(value, item, ctx)`
- `presentEventsPolicy(value, locale)`
- `presentPetsPolicy(value, locale)`
- `presentCommercialPhotographyPolicy(value, locale)`
- `presentServicesInHomePolicy(value, locale)`
- `presentFeeEnabledFlag(value, locale)`

#### `src/lib/services/guide-presenters/value-presenter-registry.ts`
Registry por `taxonomyKey` o `presentationType`.

Ejemplo:
```ts
PRESENTERS = {
  "pol.quiet_hours": presentQuietHours,
  "pol.smoking": presentSmokingPolicy,
  "pol.events": presentEventsPolicy,
  "pol.pets": presentPetsPolicy,
  "pol.commercial_photography": presentCommercialPhotographyPolicy,
  "pol.services_in_home": presentServicesInHomePolicy,
  "fee.cleaning": presentFeeEnabledFlag,
  "fee.extra_guest": presentFeeEnabledFlag
}
```

#### `src/lib/services/guide-presenters/fallback-presenter.ts`
Fallback robusto cuando no haya presenter específico.

Debe:
- detectar JSON serializado
- detectar enums snake_case
- humanizar razonablemente
- emitir warning interno
- nunca romper render

#### Tests
- `src/test/guide-presentation.test.ts`
- `src/test/guide-presentation-no-raw-json.test.ts`
- `src/test/guide-presentation-no-enum-leaks.test.ts`
- `src/test/guide-presentation-empty-states.test.ts`
- `src/test/guide-presentation-contacts.test.ts`
- `src/test/guide-presentation-registry.test.ts`

---

### 7.4 Archivos a modificar

#### `src/lib/services/guide-rendering.service.ts`
No meter toda la lógica aquí, pero sí:
- separar si hace falta `composeGuideRaw(...)`
- llamar al presentation layer al final del pipeline

#### `src/lib/types/guide-tree.ts`
Añadir opcionalmente:
- `presentationType?: string`
- `displayValue?: string`
- `displayFields?: { label: string; value: string; visibility: GuideAudience }[]`
- `presentationWarnings?: string[]`
- `isRenderableToGuest?: boolean`
- `hideWhenEmptyForGuest?: boolean` en secciones

#### `taxonomies/guide_sections.json`
Añadir soporte para:
- `hideWhenEmptyForGuest`
- `emptyCopyGuest`
- `emptyCopyInternal`

Ejemplo:
```json
{
  "id": "gs.howto",
  "hideWhenEmptyForGuest": true,
  "emptyCopyGuest": "No hay instrucciones especiales para esta estancia.",
  "emptyCopyInternal": "Añade notas de uso o runbooks..."
}
```

#### Taxonomías de policies / access / contacts / amenities
Muy recomendable añadir:
- `presentationType`
- `enumLabels`
- `guestSummaryTemplate`
- `guestCriticality`
- `quickActionEligible`

---

### 7.5 Presentaciones concretas a implementar ya

#### `pol.quiet_hours`
Input:
```json
{"to":"08:00","from":"00:00","enabled":true}
```
Output:
- `Silencio de 00:00 a 08:00`

#### `pol.smoking = designated_area`
Output:
- `Solo se permite fumar en la zona habilitada`

Si existe `smokingArea = balcones`:
- `Solo se permite fumar en los balcones`

#### `pol.events`
Input:
```json
{"policy":"small_gatherings","maxPeople":6}
```
Output:
- `Se permiten reuniones pequeñas de hasta 6 personas`

#### `pol.pets`
Input: JSON estructurado

Output recomendado:
- `Se admiten perros y gatos`
- `Máximo: 1 mascota`
- `Tarifa: 15 € por mascota y noche`
- `Restricciones: No subir a los sofás · Deben estar supervisadas`
- `Tamaño máximo: Mediano`

#### `pol.commercial_photography = not_allowed`
Output:
- `No se permite fotografía o grabación comercial`

#### `pol.services_in_home = {"allowed":false}`
Output:
- `No se permiten servicios externos dentro del alojamiento`

#### `fee.cleaning = {"enabled":false}`
Guest:
- ocultar o mostrar `No aplica`
- recomendación: ocultar si no aporta valor

#### `fee.extra_guest = {"enabled":false}`
Igual

#### Contactos
Nunca mostrar:
- `Javier: ct.host`

Mostrar:
- `Javier`
- `Anfitrión`
- `Teléfono: +34 ...`

---

### 7.6 Tests obligatorios

#### `guide-presentation-no-raw-json.test.ts`
Asegurar que en guest no aparecen:
- `{`
- `}`
- arrays serializados
- blobs JSON

#### `guide-presentation-no-enum-leaks.test.ts`
Asegurar que no aparecen en guest:
- `designated_area`
- `not_allowed`
- `small_gatherings`
- `per_pet_per_night`
- `medium_max`

#### `guide-presentation-empty-states.test.ts`
Asegurar que en guest no aparecen:
- “Añade”
- “configura”
- “runbooks”
- “aparecerán aquí”

#### `guide-presentation-contacts.test.ts`
Asegurar que:
- `ct.host`
- otros labels internos
no aparecen en guest

#### `guide-presentation-registry.test.ts`
Asegurar que todas las keys críticas actuales tienen presenter o fallback correcto:
- `pol.quiet_hours`
- `pol.smoking`
- `pol.events`
- `pol.pets`
- `pol.commercial_photography`
- `pol.services_in_home`
- `fee.cleaning`
- `fee.extra_guest`
- `contact role host`

---

### 7.7 Criterio de done
La rama se considera terminada cuando:

1. El output guest ya no muestra JSON crudo
2. El output guest ya no muestra enums internos
3. Las policies complejas se leen como lenguaje humano
4. Los contactos se renderizan correctamente
5. Los empty states guest no suenan a CMS
6. El markdown guest es publicable sin vergüenza
7. Los tests anti-leak están verdes

---

## 8. Recomendaciones UX/UI y visuales (crítico)

Esta sección es fundamental. La guía no puede quedarse en “correcta”. Tiene que sentirse premium, utilitaria y clara bajo estrés.

## 8.1 Principio general de UX visual
La guía perfecta no es una landing ni un documento.  
Es una **herramienta operativa de una sola mano, de atención parcial, móvil primero, red irregular y uso bajo microestrés**.

### Principios
- mostrar menos, mejor
- jerarquía fuerte
- acción inmediata
- máxima escaneabilidad
- mínima interpretación

---

## 8.2 Problemas visuales actuales
- casi todas las cards pesan igual
- no hay hero fuerte
- demasiada homogeneidad
- el contenido crítico no destaca lo suficiente
- el sistema se siente limpio pero algo plano
- demasiado “renderer elegante” y poco “producto hospitality premium”
- demasiado aire muerto en desktop
- imágenes con poco protagonismo
- TOC correcta pero el contenido principal aún no domina

---

## 8.3 Estructura visual recomendada

### Nivel 1 — Hero operativo
Debe ir arriba del pliegue.

Contiene:
- Entrar
- WiFi
- Parking
- Ayuda
- opcionalmente Check-out

Visual:
- botones o cards grandes
- icono + label + acción
- 1 tap real
- máximo 4–5 acciones

### Nivel 2 — Esenciales curados
No como lista normal.

Contiene:
- Check-in
- Check-out
- Dirección / Maps
- norma crítica
- contacto principal

Visual:
- cards compactas pero destacadas
- mejor diferenciación de borde/fondo/spacing

### Nivel 3 — Secciones estándar
- Llegada
- Espacios
- Cómo usar
- Equipamiento
- Normas
- Guía local
- Ayuda

### Nivel 4 — Detalle secundario
- accordions
- children
- policies extended
- fields secundarios

---

## 8.4 Sistema de cards recomendado

Necesitas al menos 4 roles visuales:

### 1) Hero card
Uso:
- quick actions
- WiFi
- acceso
- ayuda

Estilo:
- padding generoso
- más contraste
- icono claro
- acción visible
- altura mínima 56–64 px

### 2) Essential card
Uso:
- facts clave
- check-in/out
- parking
- dirección
- normas clave

Estilo:
- compacta pero destacada
- título claro
- supporting text corto
- separación fuerte entre cards

### 3) Standard content card
Uso:
- amenities
- spaces
- policy summaries
- local guide items

Estilo:
- más neutra
- borde sutil
- uso extensivo

### 4) Warning / emergency card
Uso:
- ayuda
- emergencias
- incidencias
- restricciones importantes

Estilo:
- contraste mayor
- iconografía visible
- CTA clara

---

## 8.5 Tipografía y jerarquía textual

### Recomendación base
Seguir estilo sobrio tipo Inter / system sans.

### Escala recomendada
- Page title: `28px / 1.2 / 700`
- Section title: `20px / 1.3 / 600`
- Card title: `16px / 1.3 / 600`
- Body: `16px / 1.6 / 400`
- Secondary text: `14px / 1.5 / 400`
- Micro labels: `12–13px / 1.4 / 600`

### Reglas
- body nunca menos de 16px en móvil
- labels secundarias no demasiado grises
- headings con contraste real
- evitar bloques de más de 3–4 líneas en móvil

### Problema actual a corregir
Demasiada suavidad homogénea. Falta contraste jerárquico entre:
- título de sección
- contenido primario
- supporting text
- metadata

---

## 8.6 Spacing y ritmo visual

### Escala recomendada
- `4, 8, 12, 16, 24, 32, 48`

### Uso recomendado
- padding card estándar: `16`
- gap interno pequeño: `8–12`
- separación entre cards: `16`
- separación entre secciones: `24–32`
- separación hero → contenido: `24–32`

### Problema actual
Hay bastante limpieza, pero falta “ritmo”.  
Todo está espaciado de forma razonable, pero sin intención jerárquica suficiente.

---

## 8.7 Color y contraste

### Principio
No usar color para decorar. Usar color para jerarquizar.

### Recomendación
Mantener paleta minimalista, pero usar el color primario en:
- estado activo del TOC
- quick actions
- CTA de copiar / llamar / maps
- acentos del hero
- chips críticos
- elementos de ayuda

### No hacer
- inundar fondos de color
- bajar contraste
- usar color como única señal

### Contraste
Objetivo WCAG 2.2 AA mínimo.

---

## 8.8 Sombra, bordes y superficies

### Recomendación
- fondo muy limpio
- cards con borde sutil
- sombras mínimas
- usar más spacing y contraste que shadow

### Border radius
- cards: `12`
- buttons/inputs: `10`
- chips: `9999` o `28–32px` visual

### Problema actual
La base está bien, pero falta más diferenciación entre card types.  
No es un problema de “más sombra”; es un problema de rol visual.

---

## 8.9 Fotos y vídeos

### Reglas
Las imágenes no son decoración. Son reducción de mensajes.

### Jerarquía recomendada
1. fachada / acceso
2. espacios clave
3. parking
4. equipamiento complejo
5. resto

### En cards de espacio
Usar:
- imagen principal más grande
- mejor protagonismo
- ratio consistente (ideal 4:3 o 16:10)
- thumbnails secundarias si hay más media

### Vídeo
Usarlo solo en:
- acceso
- cerraduras
- electrodomésticos complejos
- jacuzzi / chimenea / persianas / garaje

### Problema actual
La miniatura visible en espacios es demasiado pequeña para aportar verdadero valor contextual.

---

## 8.10 Search y TOC

### TOC
- mantener corta
- no competir con hero
- no listar aggregators hero
- no meter subniveles largos
- sticky simple

### Search
Debe convertirse en mecanismo principal de recuperación rápida.

Requisitos UX:
- input visible arriba
- respuesta instantánea
- “0 resultados” con hints
- accesible con teclado (`/`, `Enter`, `Escape`)
- scroll al contenido relevante

---

## 8.11 Empty states visuales

### Regla
No deben sonar a sistema.

### Ejemplos correctos
- “No hay instrucciones especiales para esta estancia.”
- “Todavía no hay recomendaciones locales disponibles.”
- “No hay parking indicado. Contacta con el anfitrión si lo necesitas.”

### Evitar
- “Añade...”
- “Configura...”
- “Runbooks...”
- “Aparecerán aquí...”

---

## 8.12 Comportamiento responsive

### Desktop
- reducir algo el aire muerto lateral
- ensanchar un poco la columna principal
- TOC compacta
- más protagonismo al contenido

### Mobile
Crítico revisar:
- hero
- acciones grandes
- body 16px
- targets 44x44 mínimo
- sections no demasiado largas
- media optimizada
- sticky UI no invasiva

---

## 8.13 Microinteracciones esenciales
Deben existir:
- copy-to-clipboard con toast
- tap-to-call
- tap-to-WhatsApp
- open in Maps
- feedback inmediato al usuario
- toasts accesibles con `role="status"`

---

## 8.14 Benchmarks visuales a igualar o superar
Objetivo:
- claridad operativa de Touch Stay
- conexión PMS / dynamic actions de Hostfully / Enso
- issue loop de Breezeway
- disciplina temporal de Airbnb para información sensible

No copiar visualmente una landing.  
Copiar el patrón de utilidad y reducción de fricción.

---

## 9. Cambios concretos recomendados

## Cambiar
1. Sustituir todos los values guest estructurados por copy humana
2. Redefinir `Esenciales` como hero operativo, no sección normal
3. Añadir fase `normalizeGuideForPresentation`
4. Reescribir empty states guest
5. Diferenciar tipos de cards
6. Dar más protagonismo a quick actions y ayuda
7. Mejorar presentación de espacios
8. Aumentar jerarquía visual

## Añadir
1. `presentationType`
2. `displayValue`
3. `displayFields`
4. `guestCriticality`
5. `quickActionEligible`
6. `emptyCopyGuest`
7. tests anti-leak de JSON/enums/editorial copy

## Quitar
1. JSON crudo
2. enums internos visibles
3. copy editorial en público
4. labels internas visibles
5. duplicación visual torpe entre `Esenciales` y `Llegada`
6. secciones vacías sin valor real para guest

---

## 10. Conclusión final

La guía actual:
- tiene una base arquitectónica seria
- ya no es un prototipo improvisado
- pero todavía no es la guía definitiva ni “top mundial”

El gap más importante no está en:
- el árbol
- el backend
- la extensibilidad

Está en:
- presentation layer
- jerarquía operativa
- quick actions
- humanización del dato
- calidad visual final

### Prioridad estratégica
Antes de meter más complejidad:
1. cerrar la capa guest
2. resolver hero + actions
3. reforzar UI/UX visual y jerarquía
4. entonces seguir con search/offline/issues/AI

### Norte real
La meta no es “renderizar todo”.  
La meta es:
> hacer que el huésped resuelva lo importante en segundos, sin pensar, y que la guía se sienta mejor que cualquier competidor.

---

# Anexo — sugerencia de inserción en roadmap

Insertar entre `10E` y `10F`:

## Rama — `fix/guest-presentation-layer`

**Propósito:** cerrar el boundary guest y humanizar la salida pública.

**Criterio de done:**
- no raw JSON
- no enums internos
- no empty-copy editorial
- policies complejas resumidas
- contacts humanizados
- tests anti-leak verdes

**Dependencias:** `10E`  
**Beneficia directamente a:** `10F`, `10G`, `10H`, `11A+`, `13D`
