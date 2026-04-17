# Implementation Plan

**Version:** `1.0 — 2026-04-16`

## Benchmark competitivo

**entity["company","YourWelcome","guest tablet platform"]** y **entity["company","Properly","vacation rental ops"]** sirven como benchmark complementario, pero no del mismo nivel de madurez pública que Touch Stay o Hostfully. YourWelcome es claramente hardware-first: tablet en propiedad, guía digital, comunicación y upsells sincronizados por PMS. Las reseñas son polarizadas: algunos hosts valoran adopción en piso, ahorro de tiempo y soporte; otras hablan de hardware flojo y soporte malo. Properly, por su parte, tiene evidencia pública más escasa y antigua sobre Coral, con énfasis en conocimiento local y guía curada; utilízalo como señal direccional, no como referencia principal de producto actual. citeturn33search2turn33search13turn41view6turn41view5turn33search3

**Touch Stay** se comporta como el benchmark puro de digital guidebook: check-in/out, Wi‑Fi, house rules, appliance guides, recomendaciones locales, multimedia, QR, traducción, offline, analytics, chatbot y upsells. Hosts y reviews destacan interfaz pulida, facilidad de edición y valor claro en reducción de preguntas; su limitación es que, fuera del guidebook, su capa operativa pública parece más ligera que la de suites más amplias. citeturn6view0turn27view0turn40view0turn40view1turn12view0turn13search4

**Hostfully** mezcla guidebook con PMS y eso le da una ventaja clara en automatización: variables dinámicas en mensajes, contenido poblado desde PMS, respuestas IA desde la guía, PINs automáticos, itinerarios, mapas y upsells. Lo más valorado en reviews es formato visual, personalización, marketplace, analytics y value for money; lo más criticado es curva inicial y, en la capa PMS general, glitches o links muertos. citeturn6view4turn6view5turn25view0turn40view4turn40view5turn12view1turn12view7turn41view2

**Duve** empuja la idea de guest app white-label y no-download a lo largo de todo el journey: pre-arrival, online check-in, digital keys, guest handbook, communication hub, analytics, upsells y cada vez más IA con sources visibles. Se valora mucho la personalización, la facilidad de uso y el impacto en guest journey y upsells; las críticas públicas más duras hablan de bugs, hidden fees y soporte débil en ciertos casos. citeturn36search0turn36search1turn36search2turn36search3turn36search5turn12view4

**Airbnb** ofrece lo nativo mínimo viable: arrival guide, house rules, house manual, Wi‑Fi, contactos y checkout cards; además, solo libera detalle de check-in 48 horas antes y expone checkout y reglas incluso antes de reservar. Su fortaleza es distribución nativa y familiaridad del usuario; su debilidad es control limitado de IA, marca, interactividad y profundidad de IA/ops comparado con vendors dedicados. citeturn24search0turn24search1turn24search2turn24search8turn24search9

**entity["company","Chekin","guest check-in spain"]** es check-in/compliance-first: registro online, identificación, verificación biométrica, contratos, pagos, remote access, tourist tax y branded guest app. Es muy fuerte en legal/compliance y procesos de llegada; la evidencia pública lo posiciona menos como guía rica de in-stay que como capa de onboarding y acceso. Su rating agregado en Capterra es bajo en soporte, así que no es la referencia UX principal para el guidebook público, aunque sí lo es para flujos de verificación y acceso. citeturn35search0turn35search5turn35search3turn35search10turn12view5

**Enso Connect** es probablemente la referencia más interesante para la unión de guía, boarding pass e IA. Tiene drag-and-drop blocks, AI autofill, Google Places, personalización con datos del huésped, 200+ idiomas, automations y un flow de IA con facts gathering, policy checking, confidence y approvals. Lo valorado: portal moderno, multi-channel, guest pre-check-in, upsells y automatización; las críticas: bugs, overcharges, complejidad puntual en filtros y casos donde la adopción del guidebook por parte de huéspedes fue menor de lo esperado. citeturn7view1turn25view1turn25view2turn12view3turn41view3turn41view4

**Breezeway** es la mejor referencia para unir guía y operaciones. Guide actualiza información durante la estancia, permite issue submission que crea tareas, soporta upsells/tipping, branding y entrega por URL autenticada sin app. Hosts valoran coordinación operativa, visibilidad y facilidad de uso; también aparecen miedos a glitches o limitaciones de integración/soporte. citeturn7view7turn7view4turn26search10turn26search6turn10search7turn14search5

### Conclusión del benchmark

La decisión estratégica correcta para vuestro producto es **copiar el patrón Touch Stay para consumo de guía**, **copiar el patrón Hostfully/Enso para unión con PMS e IA**, **copiar el patrón Breezeway para issue → task**, y **copiar de Airbnb la disciplina temporal de no exponer el acceso sensible demasiado pronto**. El resto es ruido o especialización. citeturn40view0turn25view0turn25view2turn7view5turn24search0

## Stack recomendado para la guía pública

### Front-end

**Framework base:** Next.js 15 App Router con Server Components por defecto y “client islands” solo para búsqueda, lightbox, mapas, copy-to-clipboard, selectors y métricas. El App Router está hecho precisamente para este estilo de composición. citeturn18view8

**Galería / lightbox:** `yet-another-react-lightbox`.  
Motivo: buen soporte de imágenes responsive y `srcset`, setup simple y UX madura para colecciones por espacio. citeturn19search0turn19search8

**Mapas:**  
Recomendación por defecto: **entity["company","Leaflet","mapping library"]** vía `react-leaflet`. Leaflet sigue siendo open source, móvil y muy ligero, y React Leaflet da bindings suficientes para el caso de una guía de estancia. Úsalo para mapas simples del alojamiento, parking, puntos locales y overlays ligeros. citeturn19search5turn19search13turn20search7

Usa **entity["company","Mapbox","maps platform us"]** solo si la experiencia de mapa es una parte central de diferenciación visual o funcional, porque ofrece styling fuerte y pricing usage-based con free tier razonable, pero añade dependencia y coste. citeturn20search2

Usa **entity["company","Google","search and cloud us"]** Maps Platform solo cuando Places Autocomplete, Street View o ecosistema Google sean core de negocio y aceptes su modelo de pricing. La nueva pricing page deja claro que ya convive pay-as-you-go con planes de suscripción. citeturn20search5turn20search13

**TOC sticky:** sin librería.  
Hazlo con `IntersectionObserver` y un hook propio pequeño. Para este caso, añadir una librería solo mete bytes y dependencia donde no aporta una ventaja decisiva.

**Búsqueda client-side:** `Fuse.js` por defecto.  
Motivo: fuzzy search, weighted keys, zero dependencies, bueno para datasets pequeños y medianos en cliente. Si más adelante queréis indexar miles de items offline por propiedad, `FlexSearch` es el upgrade natural. citeturn19search3turn19search7turn19search2

**PWA / offline:** enfoque manual alineado con docs oficiales de Next.js, con `manifest`, `sw.js` y caché explícita de shell, JSON crítico y media esencial. No recomiendo `next-pwa` como dependencia principal: la propia comunidad de Next lo ha señalado como poco mantenido y con problemas para App Router. citeturn31view0turn30search7turn30search15

### Back-end y contenido

**Canon de contenido:** PostgreSQL + Prisma como source of truth editorial.  
**RAG store:** mismo PostgreSQL con pgvector, usando filtros duros por `property_id`, `locale`, `audience`, `journey_stage`, `validity`. pgvector recomienda indexar también columnas filtrables junto al vector search. La versión 0.8.0 mejoró explícitamente coste y filtering. citeturn18view10turn18view9

**Embeddings:** **entity["company","OpenAI","ai company us"]** `text-embedding-3-large` como opción de calidad para ES/EN/FR/DE y `text-embedding-3-small` si el coste manda. OpenAI documenta mejora multilingüe en esta familia. citeturn18view2

**RAG method:** hybrid retrieval + rerank + contextual chunk prefixes.  
Para guía operativa, no basta con vector puro porque hay queries altamente keyworded como “wifi”, “E1”, “lockbox”, “A/C”, “PIN”. OpenAI y **entity["company","Anthropic","ai company us"]** justifican bien el enfoque de retrieval con metadatos y contextual retrieval. citeturn18view0turn18view1turn18view4turn18view5

**Serialización para LLM context:**  
- **Canonical source:** JSON estructurado.  
- **Retrieval text:** Markdown normalizado por item.  
- **Prompt wrapper:** XML opcional solo si el runtime actual lo aprovecha bien.  

Veredicto: **JSON + Markdown**, no XML como fuente de verdad. JSON es mejor para transformación, validación y tooling; Markdown es mejor para síntesis y legibilidad de modelo. OpenAI retrieval y Anthropic context engineering apoyan, por la vía de los hechos, esta separación entre estructura canónica y contexto recuperado. citeturn18view0turn18view6

## Estrategia de caching y URL management para media

### Lo correcto

Usa **ISR para la shell pública** y para el contenido no sensible relativamente estable. Next.js documenta claramente time-based revalidation y on-demand revalidation con tags/path; para guías públicas, esa es la pieza adecuada: rápido, CDN-friendly y barato. citeturn18view7

### Lo que no debes hacer

No incrustes URLs presignadas de S3/R2 de 1 hora directamente en HTML prerenderizado si ese HTML va a vivir días o semanas en caché. Te explotará en la cara justo cuando el huésped abra la guía desde el tren. AWS y Cloudflare dejan claro que las presigned URLs expiran; además, Cloudflare R2 recuerda que la misma URL sigue valiendo hasta que caduca, lo que refuerza que no son el identificador estable correcto para HTML cacheado. citeturn32search0turn32search1turn32search12

### Diseño recomendado

Sirve media a través de una **ruta estable de aplicación**:

`/g/:slug/media/:assetId/:variant`

Esa ruta debe:

1. validar si el asset es público o requiere autorización,
2. resolver el object key real,
3. generar internamente la URL firmada o recuperar el binario desde storage,
4. devolverlo con cache headers por `contentHash`,
5. ocultar al cliente la firma corta y cualquier estructura interna del bucket.

Esto desacopla el ciclo de vida del HTML del ciclo de vida de la firma. También hace posible invalidar por asset, cambiar de provider y meter optimización de imagen sin tocar contenido editorial.

### Offline / slow network

Implementa tres niveles:

**Nivel 1 — Critical offline cache**  
Guide shell, CSS, íconos, JSON crítico, sección Llegada, Wi‑Fi, Ayuda y Salida.

**Nivel 2 — Predictive image cache**  
Fachada, acceso, parking, hero de propiedad, 1 imagen por espacio.

**Nivel 3 — Lazy noncritical**  
Galerías completas, vídeo, mapas enriquecidos.

El objetivo no es que todo funcione offline; es que lo que duele más siga funcionando cuando la conexión va fatal. Ahí es donde una guía gana de verdad.

## Roadmap de features por impacto y esfuerzo

| Feature | Impacto | Esfuerzo | Dependencias |
|---|---|---:|---|
| Bloque “Esenciales de hoy” above-the-fold | Alto | Bajo | GuideTree guest renderer |
| Búsqueda universal con `Fuse.js` | Alto | Bajo | Índice de items guest |
| Copy Wi‑Fi / copy code / abrir en Maps / click-to-call | Alto | Bajo | Quick actions |
| Reestructuración IA por journey, no por taxonomía interna | Alto | Medio | Nuevos metadatos |
| Exposición temporal de acceso sensible | Alto | Medio | Reservation context + auth guard |
| Chunking RAG por item + summaries | Alto | Medio | pgvector + pipeline embeddings |
| Drafts IA con citas internas | Alto | Medio | Retrieval + prompt templates |
| Issue reporting desde guía → tarea operativa | Alto | Medio | Modelo incidencias + routing |
| PWA shell + caché crítica offline | Alto | Medio | Service worker |
| Selector de idioma ES/EN/FR/DE a nivel item | Alto | Medio | i18n content model |
| Galerías por espacio con lightbox | Medio | Bajo | Media assignments |
| Analytics por sección, búsqueda y preguntas evitadas | Medio | Medio | Event instrumentation |
| Upsells contextuales por etapa | Medio | Medio | Policies + payment/inventory |
| “Add to Home Screen” + install nudge | Medio | Medio | PWA |
| Integración “boarding pass / checkout card” | Medio | Alto | Messaging automations |

## Decisiones de arquitectura críticas y trade-offs

### JSON canónico + Markdown derivado

**Sí.**  
Ganas validación, typing, transformaciones limpias y prompts legibles.  
**Trade-off:** dos representaciones que mantener, pero es deuda buena.

### RAG atómico en vez de “árbol completo en prompt”

**Sí.**  
Ganas precisión, coste, trazabilidad y reutilización multipropósito.  
**Trade-off:** mayor trabajo de indexado y metadata.  
Compensa de sobra.

### Leaflet por defecto

**Sí.**  
Más barato, más ligero, menos lock-in, suficiente para la mayoría de guías.  
**Trade-off:** menos espectacular para mapas muy diseñados.  
Si un guía de alojamiento necesita un SIG cinematográfico, probablemente estáis resolviendo el problema equivocado.

### Media proxy estable en vez de presigned URL en HTML

**Sí.**  
Ganas estabilidad, seguridad y control de caché.  
**Trade-off:** una hop más en arquitectura.  
Es una hop que te ahorra muchos tickets.

### IA auto-send solo para bajo riesgo

**Sí.**  
Wi‑Fi, parking, checkout, y quizá preguntas básicas de appliances.  
**No** para dinero, compensaciones, incidentes de seguridad, ni ambigüedad alta. Enso describe exactamente esa separación entre low-risk auto-send y temas con human approval. citeturn25view2

### Una URL pública sin login, pero con revelado condicional

**Sí.**  
Mantienes fricción baja para guía general y aplicas control fino solo a datos sensibles.  
**Trade-off:** algo más de lógica de autorización.  
Es la combinación correcta de UX y seguridad.

## Lo que NO implementar

No conviertas la guía en un PDF largo exportado desde un CMS.  
No metas todo el GuideTree en un prompt “porque el contexto largo ya aguanta”.  
No uses tabs como estructura principal para contenido largo en móvil.  
No expongas códigos permanentes en HTML, screenshots o embeddings.  
No dupliques contenido por idioma si puedes versionar por item y locale.  
No priorices fotos de marketing por delante de fotos de acceso y uso real.  
No obligues a app download para consultar lo básico. El mercado líder vende lo contrario. citeturn36search2turn7view7turn40view1  
No lances auto-send IA en refunds, daños, seguridad o promesas operativas no verificadas.  
No adoptes hardware-only como canal principal; YourWelcome muestra que el tablet puede sumar, pero no debe sustituir un guía móvil web-first. citeturn41view6turn41view5  
No escondas el bloque crítico detrás de un hero gigante o una intro de marca. La guía no es una landing; es un instrumento.  

La síntesis brutal es esta: **la guía perfecta no es la más bonita, sino la que evita más dudas, resuelve más tareas y comete menos errores justo en el peor momento posible**. Y la KB perfecta para IA no es la más grande, sino la que hace recuperable la respuesta correcta con el menor riesgo posible.