# Guest Guide Spec

**Version:** `1.0 — 2026-04-16`

La guía pública debe comportarse como una mezcla de manual operativo, concierge móvil y red de seguridad. El patrón que se repite en el mercado es muy consistente: un enlace sin descarga, acceso inmediato desde móvil, instrucciones de llegada y salida muy visibles, contenido del alojamiento organizado por tareas reales del huésped, recomendaciones locales accionables, y cada vez más automatización conectada con mensajería, IA y upsells. Eso aparece con bastante claridad en **Touch Stay**, **Hostfully**, **Duve**, **Enso Connect**, **Breezeway** y en el stack nativo de **Airbnb**. Las reseñas y foros muestran además dos verdades incómodas pero útiles: los huéspedes preguntan una y otra vez por acceso, Wi-Fi, parking, calefacción y checkout; y mucha gente no lee bloques largos, así que la guía tiene que estar diseñada para escaneo, no para novela rusa.

## Journey Map

### Principio rector

Diseñar asumiendo que casi todo momento crítico ocurre en móvil, con una mano, atención parcial y conectividad irregular. Los estudios y reportes revisados apuntan a una preferencia fuerte por autoservicio, check-in/checkout móvil y experiencias contactless; además, casi todos los vendors líderes venden la guía como enlace web “no-download”.

### Mapa por etapa

**Antes de llegar.**  
El huésped necesita saber tres cosas antes que ninguna otra: cómo entrar, dónde aparcar y cómo conectarse a internet. En foros de hosts se repite que un mensaje corto con “check-in, Wi-Fi, parking y bins” cubre gran parte de las dudas repetitivas; desde el lado del huésped, también aparece la preferencia por recibir Wi-Fi junto con el código de acceso antes de llegar. La urgencia aquí es media-alta, y el dispositivo dominante es móvil. La guía debe enseñar un bloque “Esenciales para hoy” por encima del pliegue, incluso antes del contenido bonito.

**Llegada y acceso.**  
Aquí la urgencia es máxima. El huésped necesita dirección exacta, foto de fachada, instrucciones paso a paso, método de acceso, parking, verificación de identidad si aplica, y contacto de ayuda si algo falla. Airbnb solo muestra instrucciones detalladas de check-in 48 horas antes, y los vendors más maduros refuerzan esta fase con pasos, vídeos, PINs automáticos, boarding pass o QR. El patrón correcto no es “texto largo”; es “pasos secuenciales + foto + acción inmediata”. Dispositivo: móvil, a menudo en calle o coche.

**Primera hora dentro.**  
Una vez dentro, la jerarquía cambia de golpe: Wi-Fi, calefacción/AC, agua caliente, interruptores clave, TV, basura, y qué está permitido usar. En comunidades de Airbnb se repite que Wi-Fi es “la pregunta más común” y que fotos anotadas ayudan mucho más que texto abstracto. La urgencia sigue siendo alta, pero ya es una urgencia de instalación, no de acceso. Dispositivo: móvil; secundariamente tablet o portátil si la estancia es más larga.

**Durante la estancia.**  
La guía pasa de “manual de aterrizaje” a “copiloto”. El huésped consulta cómo usar equipamiento, reglas de ruido, lavandería, piscina o jacuzzi, recomendaciones locales, transporte, supermercados y resolución de incidencias. Aquí la urgencia se divide entre consultas consultivas y micro-incidencias. El patrón ganador es self-service con búsqueda, FAQ y acciones directas; por eso Touch Stay habla de un lugar “searchable”, Breezeway convierte incidencias en tareas, y Duve/Enso integran la guía con mensajería e IA. Dispositivo: móvil para necesidad puntual; sofá/tablet para explorar recomendaciones locales.

**Noche anterior a la salida y checkout.**  
Muchos hosts envían recordatorio la noche anterior porque el checkout tardío, las dudas sobre basura y las expectativas confusas dañan la rotación operativa. Airbnb ha formalizado este momento con checkout instructions y checkout cards. La mejor práctica es una lista de salida breve, razonable y sin “chore list” absurda; la literatura de Hostfully y la guía de Airbnb convergen bastante en esto. Dispositivo: móvil. Urgencia: alta pero previsible.

**Post-estancia.**  
La guía todavía puede servir para facturas, objetos perdidos, reviews y recompra directa. La urgencia baja mucho, pero sigue siendo útil un bloque final con “¿Olvidaste algo?” y “Reserva de nuevo”. En mercado, los vendors más completos lo conectan con CRM, mensajes automatizados, contactos y ofertas futuras.

## Information Architecture

### Estructura óptima de secciones

El orden correcto no es el del PMS ni el del modelo de datos. Es el del cerebro del huésped. La arquitectura ideal para `/g/:slug` debe ser esta, en este orden:

**Inicio de estancia**  
No es una portada decorativa; es un panel operativo. Debe mostrar nombre del alojamiento, ventana horaria de check-in o estado de estancia, quick actions y cuatro respuestas inmediatas: entrar, aparcar, Wi-Fi, ayuda. Los productos que mejor convierten la guía en menos mensajes lo hacen llevando lo crítico arriba, no enterrándolo en secciones profundas.

**Llegada**  
Contenido requerido: dirección exacta, enlace a mapas, descripción de acceso, método de entrada, fotos de referencia, parking, edificio/portería, ascensor/escaleras, check-in alternativo si falla el principal.  
Patrón UX: pasos numerados, 1 acción por bloque, foto o mini-video por paso, botón de copiar código solo cuando el huésped está autorizado a verlo.  
Ejemplo de qué mostrar: “1. Busca la puerta gris junto a la farmacia. 2. Introduce el código. 3. Gira el pomo hacia arriba. 4. Si no funciona tras dos intentos, llama al contacto de acceso.”

**Esenciales de la estancia**  
Contenido requerido: Wi-Fi, calefacción/AC, agua caliente, basura/reciclaje, silencio/horario, fumar/no fumar, mascotas, contacto principal y FAQ rápida.  
Patrón UX: grid de cards con icono y texto de 1–2 líneas; esto debe ser visible sin scroll excesivo y sin abrir subniveles.  
Ejemplo de qué mostrar: “Wi-Fi — Red: CasaAzul_5G — Contraseña: copiar”; “Calefacción — Termostato en salón — guía de 3 pasos”; “Basura — orgánico en cubo verde — vidrio en contenedor callejero”.

**Espacios**  
Contenido requerido: una ficha por espacio real, no por categoría abstracta. Dormitorio, salón, cocina, baño, terraza, garaje, piscina, cuarto de lavandería, etc. Cada ficha debe responder “qué hay aquí”, “qué puede usar el huésped” y “qué advertencias aplican”.  
Patrón UX: cards de espacio con foto principal, chips de amenities y CTA “cómo usar este espacio”.  
Ejemplo de qué mostrar: “Cocina — horno, inducción, cafetera, lavavajillas — no usar estropajo en isla de mármol”. La organización por espacio reduce ambigüedad mejor que una lista plana de amenities.

**Cómo usar la casa**  
Contenido requerido: equipamiento y procedimientos, no solo inventario. TV, horno, vitro, cafetera, hot tub, chimenea, cerraduras, persianas, cargadores EV, piscina, alarmas técnicas, etc.  
Patrón UX: cada item como FAQ operativa o mini runbook; usar vídeo corto cuando hay manipulación física o varios pasos. Las guías de ejemplo de Touch Stay destacan precisamente que el vídeo funciona mejor que el texto para hot tub, chimenea y aparatos.  
Ejemplo de qué mostrar: “Lavadora — 1. Pulsa Power. 2. Programa 40°. 3. Añade detergente en cajetín II. 4. No usar secadora tras las 22:00”.

**Normas y límites**  
Contenido requerido: ruido, visitas, fiestas, fumar, mascotas, uso de zonas comunes, horas de piscina, límites de ocupación, cámaras exteriores declaradas, reglas legales locales relevantes y consecuencias prácticas. Airbnb insiste en que reglas y limitaciones de amenities deben estar claramente divulgadas; además, las comunidades de hosts muestran que las reglas se incumplen más cuando son genéricas o se descubren tarde.  
Patrón UX: chips y frases cortas; las reglas largas deben ir en accordion, nunca en un muro de texto.  
Ejemplo de qué mostrar: “Silencio exterior: 22:00–08:00”; “Piscina: 09:00–21:00”; “No invitados no registrados”.

**Guía local**  
Contenido requerido: supermercado, farmacia, restaurantes, desayuno, parking alternativo, transporte, urgencias cercanas, actividades por perfil y duración, más un subconjunto “a 10 minutos”. Los productos líderes convierten la guía local en motor de experiencia y, a veces, de ingresos.  
Patrón UX: categorías simples, mapas enlazados, distancia/tiempo, horarios y tel cuando existan; permitir “guardar” o “copiar a Maps”.  
Ejemplo de qué mostrar: “Desayuno cerca — Café Norte — 6 min a pie — abre 07:30 — ideal para niños”.

**Ayuda y emergencias**  
Contenido requerido: emergencia médica, incendio, fuga de agua/gas, corte eléctrico, cerrajero, contacto anfitrión, contacto backup, instrucciones de seguridad, ubicación de extintor y cuadro eléctrico si procede, y qué hacer primero.  
Patrón UX: bloque visual distinto, iconografía de alta señal, teléfonos click-to-call, y micro-runbooks tipo “si pasa X, haz Y”.  
Ejemplo de qué mostrar: “No hay calefacción — comprueba termostato — si aparece E1, reinicia con el botón lateral — si no vuelve, llama al soporte técnico”. Esto sirve al huésped y también entrena a la IA.

**Salida**  
Contenido requerido: hora, pasos razonables, llaves/cerradura, basura, toallas, luces/AC, última comprobación, recordatorio de objetos personales y canal para incidencias de salida.  
Patrón UX: checklist corta, con una frase por tarea y tono neutral. Nada de mandar al huésped a hacer limpieza profunda.  
Ejemplo de qué mostrar: “Antes de irte: 1. Saca tu basura. 2. Deja toallas usadas en la ducha. 3. Cierra ventanas. 4. Pulsa Lock al salir”.

### Visibilidad por audiencia

El modelo `guest / ai / internal / sensitive` es correcto, pero necesita reglas tajantes.

**guest** debe contener solo la mejor respuesta pública posible: clara, breve, accionable y sin ambigüedad. Nada de notas para el equipo, “si falla llamar a Pedro el cerrajero que siempre tarda”, o referencias a vendors internos.

**ai** debe incluir todo lo de guest más `aiNotes`, pasos de diagnóstico, criterios de excepción, sinónimos, restricciones, estado de confianza, y rutas de escalado. Enso, Hostfully y Duve convergen en la misma idea: la IA es útil cuando responde con datos del PMS/guía/políticas y cuando deja rastro de la fuente o del razonamiento operativo.

**internal** debe incluir playbooks operativos, contactos de proveedores, horarios de mantenimiento, reglas de coste, notas del owner, instrucciones de limpieza y troubleshooting no apto para huésped.

**sensitive** debe reservarse para códigos, combinaciones, ubicaciones de llaves de respaldo, detalles de alarmas, control de accesos, información personal, y cualquier dato que aumente superficie de riesgo si se filtra. Airbnb retrasa las instrucciones detalladas de acceso hasta 48 horas antes del check-in; tómalo como señal de mercado, no como capricho.

### Reglas de seguridad para accesos y datos sensibles

No publiques códigos persistentes en HTML estático.  
No indexes contenido sensible para búsquedas públicas.  
No metas combinaciones ni códigos perpetuos en embeddings accesibles a cualquier flujo de IA.  
Muestra acceso sensible solo si hay contexto de reserva válido o un token efímero.  
Si el método de acceso cambia por estancia, el código debe vivir fuera del árbol público y resolverse en tiempo de consulta.  

Esto no es paranoia: si el HTML se sirve con URLs o datos caducables, acabarás con guías “bonitas” que fallan justo cuando el huésped está en la puerta. Además, las URLs presignadas de S3 y R2 expiran y no son buena base para incrustar secretos o media duradera en páginas prerenderizadas.

## UX Patterns

### Layout mobile-first

El layout recomendado es un **single-column shell** con ancho efectivo móvil del 100%, padding horizontal de `16px`, y un ancho máximo de lectura de `680px` en desktop. Body text en `16px`, `line-height: 1.6`, headings comprimidos y nada de párrafos de más de 4 líneas en móvil. La evidencia de NN/g sigue siendo brutalmente vigente: la gente escanea, no lee palabra por palabra.

El header debe ser fijo y muy bajo en fricción: logo o nombre corto, buscador, selector de idioma y, solo cuando aplica, una pastilla “Hoy” o “Tu llegada”. No recomiendo bottom tabs como navegación principal: funcionan peor en contenido largo y jerárquico que un buscador bueno más TOC corto y sticky.

### Navegación

La navegación óptima combina tres capas:

**Búsqueda universal** como primer mecanismo de recuperación. Si el huésped piensa “Wi-Fi” y tarda más de un segundo en deducir dónde está, ya has perdido. Touch Stay y el discurso de varias reseñas/foros apuntan precisamente a “one searchable place”.

**Quick actions** siempre visibles para lo urgente: “Cómo entrar”, “Wi-Fi”, “Cómo llegar”, “Llamar”, “WhatsApp”, “Checkout”. Esto reduce la carga cognitiva de la arquitectura completa.

**TOC sticky corta** para navegación semántica: Llegada, Casa, Normas, Local, Ayuda, Salida. En páginas largas, NN/g avala accordions y estructuras de progressive disclosure en móvil, pero avisa de que deben usarse con buena señalización y sin desorientar.

### Patrones de contenido

Usa **cards** para información de alta frecuencia y baja profundidad.  
Usa **accordions** para detalle secundario.  
Usa **chips** para restricciones y atributos rápidos.  
Usa **galerías** por espacio y no una ensalada de fotos indiferenciada.  
Usa **FAQ** para dudas repetidas.  
Usa **mapas o enlaces a Maps** solo donde ayudan a ejecutar una acción, no como adorno.  

Un huésped no quiere explorar tu taxonomía; quiere resolver una microtarea. Cada patrón debe responder a eso.

### Media

La media más útil no es la hero photo bonita; es la foto que evita un mensaje o una incidencia. Por eso la jerarquía correcta es:

foto de fachada y acceso,  
foto por espacio,  
vídeo corto para equipamiento complejo,  
thumbnails para contexto,  
hero discreta para confianza visual.

Touch Stay, Hostfully y Duve destacan explícitamente vídeo, imágenes y branding, pero lo que realmente mueve la aguja es la claridad de instrucciones visuales.

### Accessibility mínima requerida

Cumplimiento base: WCAG 2.2 AA. Eso significa contraste suficiente, foco visible, navegación por teclado, texto alternativo útil, formularios claros y targets táctiles que no obliguen al usuario a jugar a Operación. WCAG 2.2 fija `24x24 CSS px` como mínimo AA para targets y `44x44` como referencia mejorada; para una guía operativa conviene adoptar `44x44` en todos los botones críticos. Las imágenes deben tener `alt` significativo cuando transmiten información, especialmente fachada, acceso y paneles de equipamiento.

### Multilenguaje

Debes soportar al menos español, inglés, francés y alemán como contenido de primera clase, no como post-it pegado encima. La mejor práctica observada es un selector visible a nivel de guía completa y, a la vez, permitir que la IA o la mensajería usen el idioma de preferencia del huésped. Touch Stay y Enso ya comercializan traducción multilenguaje de forma explícita. Recomendación: almacenar idioma canónico por item, no traducir solo páginas enteras.

### Empty states

Los vacíos también enseñan.  
Si no hay recomendaciones locales: “Aún no hay recomendaciones curadas para esta categoría; usa supermercados, farmacia y transporte del bloque esencial.”  
Si no hay parking: dilo explícitamente y ofrece alternativa.  
Si un amenity no está disponible por temporada o avería: no lo escondas; muestra estado, rango temporal y alternativa.  

La ausencia de información explícita genera mensajes; una ausencia bien diseñada reduce fricción. Airbnb además insiste en divulgar restricciones y disponibilidad real de amenities.

## Design System Tokens

### Colores

Usa una paleta corta y funcional:

- `--bg`: `#FFFFFF`
- `--surface`: `#F8FAFC`
- `--text`: `#0F172A`
- `--muted`: `#475569`
- `--border`: `#E2E8F0`
- `--primary`: `#0F766E`
- `--primary-strong`: `#115E59`
- `--warning`: `#B45309`
- `--danger`: `#B91C1C`
- `--success`: `#166534`
- `--info`: `#1D4ED8`

Regla: contraste AA para todo texto funcional; nunca usar color como única señal.

### Tipografía

- **Body:** `Inter 16px / 1.6 / 400`
- **Small body:** `Inter 14px / 1.5 / 400`
- **Section title:** `Inter 20px / 1.3 / 600`
- **Page title:** `Inter 28px / 1.2 / 700`
- **Card label:** `Inter 13px / 1.4 / 600 / uppercase opcional solo en micro-labels`
- **Button text:** `Inter 15px / 1.2 / 600`

### Espaciado

- `4, 8, 12, 16, 24, 32, 48`
- Padding de card principal: `16`
- Separación entre secciones: `24`
- Separación entre grupos críticos: `32`
- Radius estándar: `12`
- Radius de botón/field: `10`
- Sombra: mínima; la jerarquía debe venir de spacing y contraste, no de sombras de discoteca.

### Componentes base

- Header sticky: `56px`
- Search input: `44px` altura
- Quick action button: `44–48px`
- Section card: padding `16`, gap `12`
- Accordion row: min-height `48`
- Gallery thumbnail: `72–96px`
- Badge/chip: `28–32px`

## Interactividad

La interactividad valiosa es la que resuelve tarea real, no la que queda bien en Dribbble. Las prioridades son estas:

**Copiar Wi-Fi con un toque.**  
Esta interacción debe existir y estar arriba. Si un huésped busca una contraseña, escribirla a mano en 2026 ya es castigo corporal UX. La evidencia cualitativa de foros y reportes apunta a que Wi-Fi sigue siendo uno de los top asks.

**Click-to-call y click-to-message.**  
En ayuda, acceso y emergencias, cada contacto debe tener acción directa. Nada de mostrar un teléfono como texto muerto.

**Open in Maps.**  
Cada punto local y el propio alojamiento deben ofrecer “Abrir en Maps”. Hostfully enfatiza Google/Apple Maps y Duve vende guest app con acceso directo a información local. 

**Issue reporting estructurado.**  
El patrón de Breezeway es muy bueno: dejar que el huésped reporte un problema desde la guía y convertirlo en tarea. Esto añade valor real porque une experiencia de huésped y operación. Debe implementarse al menos para “no puedo entrar”, “no hay agua caliente”, “no funciona calefacción/AC”, “ruido”, “limpieza”. 

**Modo offline / conexión lenta.**  
La guía debe mantener funcional el shell, el bloque esencial, los textos críticos y miniaturas de acceso cuando la conexión falle. Touch Stay comercializa explícitamente uso offline; en vuestro stack, eso se traduce en PWA + service worker + caché del contenido crítico. 
**Instalar en pantalla de inicio.**  
No hace falta convertir esto en una app nativa para que parezca una buena app. Next.js documenta PWA con manifest, service worker y Add to Home Screen; Duve y Enso ya explotan patrones “boarding pass / guest app / wallet”. Recomiendo ofrecerlo solo después del primer valor real, no en el primer segundo de la visita. 

**Sugerencias dinámicas de etapa.**  
Una innovación de alto valor y bajo humo es cambiar la prioridad visual según momento: antes de llegar, enseñar Llegada; durante la estancia, Equipamiento y Local; la noche anterior, Salida. Esto ya está implícito en checkout cards, boarding passes y mensajes programados del mercado. 

**Galerías por espacio.**  
No sirve una galería global donde el huésped se pierde. La foto tiene que estar pegada a la tarea.

**Vídeo corto de procedimientos complejos.**  
Especialmente acceso, cerraduras, electrodomésticos delicados, jacuzzi, chimenea, persianas motorizadas, garaje.

**Búsqueda instantánea.**  
Con resultados por secciones e items, y priorizando exact match sobre semántica blanda.

**FAQ accionables.**  
Preguntas con respuesta breve y, si aplica, CTA o escalado.

**Mapas y lugares guardables.**  
La guía local tiene más valor cuando permite ejecutar: reservar, llamar, navegar, copiar dirección.

**Estados temporales.**  
Amenities de temporada, mantenimiento temporal, cortes previstos o instrucciones válidas solo en cierta ventana.

**Contenido descargable/offline light.**  
No hace falta una PWA mastodóntica de primeras, pero sí asegurar que el contenido esencial, una vez abierto, aguante conexión mala.

## Métricas de éxito

La guía funciona si reduce incertidumbre y carga operativa sin empeorar la experiencia.

### Métricas principales

- **Guide open rate** por reserva
- **First-session success rate** en tareas críticas
- **Search success rate**
- **Top searched terms**
- **Zero-result searches**
- **Reduction in repetitive messages**
- **Contact escalation rate**
- **Issue creation rate desde la guía**
- **Checkout compliance rate**
- **Clicks en quick actions**
- **CTR de guía local**
- **Uso de traducciones por idioma**
- **Tiempo hasta resolver una incidencia guiada**
- **Guest satisfaction / CSAT post-stay**
- **Host-perceived usefulness**

### Señales de que la guía está mal

- El top 5 de mensajes repetidos sigue siendo Wi-Fi, acceso, parking, checkout y calefacción.
- Muchas búsquedas sin resultado.
- Los huéspedes abren la guía pero no interactúan con quick actions.
- Los contactos reciben llamadas para temas que deberían resolverse solos.
- Las incidencias llegan sin contexto porque la guía no guiaba el diagnóstico.
- La guía local apenas se usa.
- El contenido multilenguaje no se consulta o genera confusión.
- El tiempo en página es alto pero el éxito de tarea es bajo: típico síntoma de “mucha lectura, poca claridad”.

## Recomendación final de producto

La guía perfecta del huésped no es una guía bonita. Es una interfaz operativa centrada en microtareas del journey real: llegar, entrar, instalarse, usar la casa, evitar problemas, salir sin fricción y recordar el sitio con ganas de volver.

Traducido a producto:
- menos portada y más panel operativo,
- menos taxonomía interna y más tareas reales,
- menos párrafo y más card/runbook/FAQ,
- menos “contenido general” y más contexto por momento,
- menos fricción en acceso y más seguridad en datos sensibles,
- menos fotos decorativas y más evidencia visual útil,
- menos guía aislada y más sistema conectado con IA, mensajería e incidencias.