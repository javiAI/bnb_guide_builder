# AI Knowledge Base Spec

**Version:** `1.0 — 2026-04-16`

La base de conocimiento para IA no debe ser una copia del guidebook. Debe ser una **capa operativa con privilegios, contexto, validez temporal y rutas de acción**. Los productos que ya están empujando IA útil en hospitality convergen en lo mismo: la IA responde bien cuando puede recuperar hechos del PMS, house manual, políticas y estado del huésped; citar o rastrear la fuente; y escalar a humano cuando hay riesgo, dinero, ambigüedad o seguridad. Eso aparece muy claro en Hostfully, Enso y Duve. [Download and upload objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

## Casos de uso y prioridad

### P0

**Responder preguntas factuales del huésped.**  
Ejemplos: Wi‑Fi, parking, cómo entrar, calefacción, basura, checkout. Esto es el pan de cada día, reduce carga operativa y tiene bajo riesgo cuando la fuente es fiable. En Enso, estos temas son precisamente los candidatos a auto-send; Breezeway y Hostfully orientan la guía y la IA a reducir back-and-forth en cuestiones repetitivas. [IA de razonamiento para Mensajería de huéspedes en Alquileres vacacionales](https://ensoconnect.com/es/resources/reasoning-ai-for-guest-messaging-in-vacation-rentals)

**Triage de incidencias durante la estancia.**  
Ejemplos: no funciona calefacción, no hay agua caliente, no abre la cerradura, ruido, limpieza. La IA debe diagnosticar, guiar y decidir si escalar. Breezeway muestra el patrón más operativo: issue desde la guía que se convierte en tarea. Enso añade evaluación de elegibilidad, confianza y routing. [Reduce questions with a mobile welcome book](https://www.breezeway.io/guide)

**Mensajería automática por etapa.**  
Confirmación, pre-arrival, day-of-arrival, mid-stay, nudge de checkout. Hostfully y Hostaway documentan plantillas, variables y automatización por momentos del journey. [Seamless PMS and guidebook syncing, smarter guest communication](https://www.hostfully.com/property-management-software/features/guidebook-integration/)

### P1

**Mensaje de bienvenida personalizado.**  
Con nombre, duración, motivo del viaje si existe, idioma, amenities relevantes y próximo hito. Duve y Enso explotan personalización basada en pre-check-in, PMS y segmentación. [Transform How You Do Hospitality](https://duve.com/)

**Upselling contextual.**  
Early check-in, late checkout, transporte, experiencias, limpieza extra. Debe estar estrictamente condicionado por política, inventario y ventana temporal. Chekin, Hostfully, Duve y Enso insisten bastante en esto. [chekin](https://chekin.com/en/)

**Copiloto para host y operaciones.**  
Draft de respuestas, resumen de conversación, recomendación de siguiente acción, y briefings para limpieza o mantenimiento. Duve ya expone “sources” en respuestas IA; Enso describe logging, confidence y approval loops. [Duve](https://helpcenter.duve.com/hc/en-us/articles/7769709812765-Duve-Product-Updates)

### P2

**Reporting operativo.**  
Resúmenes diarios por propiedad, top preguntas, top fallos de búsqueda, incidencias por categoría, gaps de contenido.

**Señales para pricing y reputación.**  
No recomiendo que el Guide Builder se convierta en motor de revenue management, pero sí que emita señales: confusión sobre parking, quejas de temperatura, demanda recurrente de early check-in, uso de amenities, etc. El informe de Access Hospitality subraya el coste real de sistemas desconectados; la KB debe servir también como fuente ordenada de insights. [2025 Report: AI in the Hospitality Sector](https://www.theaccessgroup.com/en-gb/hospitality/2025-report-ai-in-the-hospitality-sector/)

## Esquema del AI Context

### Principio de diseño

El formato canónico debe ser **JSON estructurado**; el formato de recuperación y generación debe ser **Markdown normalizado por chunk**; y el árbol completo solo debe entrar en prompt en propiedades minúsculas o como fallback muy controlado. OpenAI y Anthropic coinciden en lo esencial: retrieval con metadata, chunking y contexto tenso; no inflar el prompt con todo “por si acaso”. [Open AI developers](https://developers.openai.com/api/docs/guides/retrieval)

### Capas del contexto

**Reservation context**  
Qué reserva, quién, cuándo, cuántos, idioma, canal, estado de check-in, estado de pago, ventana actual del viaje, permisos para datos sensibles.

**Property profile**  
Property id, slug, timezone, address, check-in/out base, amenities clave, restricciones, legal requirements.

**Operational facts**  
Hechos atómicos que responden preguntas concretas. Ejemplo: “Wi‑Fi network”, “parking rule”, “trash schedule”, “thermostat location”.

**Procedures**  
Runbooks con pasos, precondiciones, fallos comunes y escalado. Ejemplo: “cómo abrir cerradura”, “cómo reiniciar calefacción”.

**Policies**  
Normalizadas, testables y con condiciones. Ejemplo: “early check-in permitido si limpieza completa y con fee X”.

**Contacts and escalation**  
Quién atiende acceso, mantenimiento, emergencias, owner, after-hours backup, y en qué horario.

**Local knowledge**  
Places, categorías, horarios, notas curadas, distancia, suitability tags.

**Style and channel**  
Idioma, tono de marca, límites de longitud, canal de salida, si puede enviar enlaces, si debe incluir CTA o pedir confirmación.

### Esquema recomendado

```json
{
  "reservation": {
    "reservationId": "res_123",
    "propertyId": "prop_42",
    "guestFirstName": "Ana",
    "locale": "es-ES",
    "channel": "airbnb",
    "arrivalDate": "2026-07-05",
    "departureDate": "2026-07-08",
    "guestCount": 3,
    "hasCheckedIn": false,
    "sensitiveAccessAllowed": true,
    "journeyStage": "pre_arrival"
  },
  "property": {
    "name": "Casa Azul",
    "timezone": "Europe/Madrid",
    "city": "Málaga",
    "brandVoice": "cercano, claro, breve"
  },
  "facts": [
    {
      "id": "wifi_main",
      "section": "essentials",
      "question": "¿Cuál es el WiFi?",
      "answer": "Red CasaAzul_5G. Contraseña SolyMar2026.",
      "audience": ["guest", "ai"],
      "sensitivity": "low",
      "validFrom": null,
      "validTo": null,
      "sourceOfTruth": "guide_tree",
      "lastVerifiedAt": "2026-04-10T12:00:00Z"
    }
  ],
  "procedures": [
    {
      "id": "heating_reset",
      "section": "equipamiento",
      "title": "Reiniciar calefacción",
      "steps": [
        "Comprueba que el termostato del salón tiene pilas.",
        "Pulsa Power 3 segundos.",
        "Si aparece E1, apaga el cuadro 30 segundos y vuelve a encender."
      ],
      "diagnosticQuestions": [
        "¿Ves algún código de error?",
        "¿La casa tiene electricidad normal?"
      ],
      "escalateIf": [
        "olor a quemado",
        "sin electricidad",
        "error persiste tras reinicio"
      ]
    }
  ],
  "policies": [],
  "contacts": [],
  "localPlaces": [],
  "responseRules": {
    "maxLength": 700,
    "mustCiteChunkIds": true,
    "autoSendAllowedTopics": ["wifi", "parking", "checkout"],
    "humanReviewTopics": ["refund", "damage", "safety", "payment"]
  }
}
```

### Campos obligatorios por chunk

Cada chunk recuperable debe incluir como mínimo:

`chunk_id`, `property_id`, `guide_path`, `section_key`, `item_key`, `chunk_type`, `locale`, `audience`, `sensitivity`, `journey_stage`, `urgency`, `actionability`, `source_of_truth`, `last_verified_at`, `valid_from`, `valid_to`, `parent_ids`, `space_id` cuando aplique, `contact_ids` relacionados, `policy_ids` relacionados, `related_chunk_ids`, y `embedding_text`.

OpenAI documenta metadata filtering a nivel de retrieval/file search; pgvector recomienda además indexar también las columnas de filtro cuando hay `WHERE` junto con nearest-neighbor. Eso encaja perfectamente con `property_id`, `locale`, `audience`, `sensitivity` y `journey_stage` como filtros previos duros. [Open AI development](https://developers.openai.com/api/docs/guides/tools-file-search)

## Estrategia de chunking para RAG

### Regla de granularidad

La unidad primaria debe ser **item por item**, no sección completa.  
La unidad secundaria debe ser un **summary chunk por sección**.  
La unidad terciaria puede ser un **property summary chunk** para warm-up o fallback.  

Eso permite responder “¿dónde está el Wi‑Fi?” con un chunk minúsculo, sin arrastrar media guía; pero también permite recuperar contexto de sección si la pregunta es vaga o compuesta. Anthropic recomienda chunking por heading/subheading para el pipeline más simple, y OpenAI recomienda dividir textos largos en chunks en vez de truncarlos. [Retrieval augmented generation](https://platform.claude.com/cookbook/capabilities-retrieval-augmented-generation-guide)

### Tipos de chunk

**fact**  
Respuesta atómica a una pregunta concreta.

**procedure**  
Pasos secuenciales con fallos frecuentes, reglas de seguridad y escalado.

**policy**  
Norma condicional y testable.

**place**  
Ficha local con acción: horario, distancia, categoría, link.

**troubleshooting**  
Árbol corto de diagnóstico.

**summary**  
Resumen de sección o propiedad para recall amplio.

**template**  
Plantillas de mensaje aprobadas por negocio.

### Tamaño recomendado

Como guía práctica:

- `fact`: 40–120 palabras
- `policy`: 60–160 palabras
- `procedure`: 80–220 palabras o 3–7 pasos
- `place`: 40–100 palabras
- `summary`: 120–300 palabras

No recomiendo chunks gigantes. Cuanto más chico sea el dato, más fácil es reutilizarlo en respuesta, mensajería, clasificación y alertas. El contexto extra se resuelve con `related_chunk_ids` y summaries, no con ladrillos de texto.

### Contextual retrieval

Cada chunk debe llevar un prefijo de contexto antes de embeddear, inspirado en Contextual Retrieval de Anthropic. Ejemplo:

```text
Property: Casa Azul, Malaga.
Section: Essentials > Wi-Fi.
Applies to: all guests during stay.
Sensitivity: low.
Question this chunk answers: "¿Cuál es la red y la contraseña del Wi‑Fi?"
```

Esto ayuda mucho cuando el chunk, aislado, sería ambiguo. Anthropic reporta mejoras claras en retrieval con este enfoque, especialmente combinado con reranking. [Introducing Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)

### Flujo de retrieval recomendado

1. **Filtro duro** por `property_id`, `locale`, `audience=ai`, `validity window`, `sensitivity allowance`.  
2. **Hybrid search**: keyword/BM25 + vector search.  
3. **Rerank** por pregunta actual + journey stage + reservation state.  
4. **Merge** de chunk principal + related chunks + summary chunk si la respuesta requiere más de una pieza.  
5. **Guardrail**: si el top result es sensible y no está permitido, no enviar; pedir verificación o redirigir.  
6. **Generation** con cita a `chunk_id` y ruta de escalado.

### Qué necesita la IA que el huésped no necesita

El huésped necesita la respuesta mínima correcta.  
La IA necesita además:

- nombre de la pregunta canónica,
- sinónimos y keywords,
- condiciones de aplicabilidad,
- estado de validez,
- prioridad/urgencia,
- permisos,
- contactos alternativos,
- ramas de fallo,
- no-go rules,
- cuándo NO contestar,
- cuándo pedir confirmación,
- cuándo escalar.

En resumen: la guía del huésped es un front-end; la base de conocimiento de IA es un sistema experto ligero.

## Prompt templates

### Respuesta factual al huésped

```text
SYSTEM
Eres el asistente de huéspedes de {{property_name}}.
Responde solo con información presente en los chunks recuperados.
Si falta un dato, dilo claramente y escala.
No inventes políticas ni horarios.
Si el tema es sensible o de seguridad, verifica primero si {{sensitiveAccessAllowed}} es true.

INPUTS
- reservation_context
- user_message
- retrieved_chunks[]
- brand_voice
- channel_rules

OUTPUT RULES
- Idioma: {{locale}}
- Longitud: 80-220 palabras
- Estructura:
  1) respuesta directa
  2) pasos concretos si aplican
  3) siguiente acción si algo falla
  4) citations: [chunk_id...]

EXAMPLE TASK
Usuario: "¿Dónde está el WiFi?"
```

### Mensaje de bienvenida personalizado

```text
SYSTEM
Redacta un mensaje de bienvenida corto, humano y útil.
No repitas información ya enviada hoy.
Incluye solo 3 elementos:
1) saludo personalizado
2) el siguiente hito operativo
3) un recordatorio útil de alto valor

INPUTS
- guest_first_name
- arrival_date
- stay_length
- travel_reason_if_known
- locale
- property_highlights[]
- next_horizon_chunk
- essentials_chunks[]
- tone_profile

OUTPUT RULES
- 90-160 palabras
- No usar emojis salvo que tone_profile lo permita
- Añadir CTA final solo si reduce incertidumbre
```

### Detección y resolución de problema de calefacción

```text
SYSTEM
Tu objetivo es diagnosticar sin poner en riesgo al huésped.
Usa el playbook técnico recuperado.
Si detectas señales de seguridad, deja de diagnosticar y escala de inmediato.

INPUTS
- user_message
- heating_procedure_chunks[]
- safety_chunks[]
- contacts[]
- reservation_context

OUTPUT RULES
- Paso 1: clasifica el problema (simple / técnico / seguridad)
- Paso 2: formula hasta 2 preguntas diagnósticas
- Paso 3: da un máximo de 4 pasos
- Paso 4: escalado si aplica
- Nunca sugieras abrir equipos, manipular gas o cuadro eléctrico salvo que el playbook lo autorice explícitamente
```

### Solicitud de early check-in / late checkout

```text
SYSTEM
Evalúa elegibilidad antes de redactar.
No prometas nada si faltan condiciones.
Si hay fee o impacto económico, marca human_review_required=true.

INPUTS
- reservation_context
- policy_chunks[]
- operational_status
- pricing_rule_if_any
- user_message

OUTPUT JSON
{
  "eligible": true|false|unknown,
  "human_review_required": true|false,
  "draft_reply": "...",
  "policy_citations": ["..."],
  "missing_data": []
}
```

### Briefing para limpieza o mantenimiento

```text
SYSTEM
Convierte la conversación del huésped y los chunks relevantes en un briefing operativo.
Escribe para equipo interno, no para guest-facing.

INPUTS
- conversation_summary
- relevant_chunks[]
- property_context
- contacts
- urgency_level

OUTPUT RULES
- Formato:
  - problema
  - ubicación exacta
  - pasos ya intentados
  - riesgo / prioridad
  - acción siguiente
  - contacto o proveedor sugerido
  - citations: [chunk_id...]
```

## Campos extra recomendados en el modelo de datos

### Críticos

Añadiría estos campos cuanto antes:

`canonicalQuestion[]`  
`keywords[]`  
`journeyStage`  
`urgencyLevel`  
`sensitivityLevel`  
`actionabilityType`  
`validFrom`  
`validTo`  
`sourceOfTruth`  
`lastVerifiedAt`  
`guestFacingSummary`  
`aiSummary`  
`diagnosticQuestions[]`  
`stepList[]`  
`escalateIf[]`  
`fallbackContactId`  
`relatedNodeIds[]`  
`contentHash`  
`embeddingTextOverride`

Estos campos convierten un árbol editorial en una KB utilizable por retrieval, mensajería y clasificación.

### Muy recomendados

`audienceOverrides`  
`channelOverrides`  
`localeStatus`  
`spaceId`  
`amenityInstanceId`  
`policyRuleId`  
`requiresReservationContext`  
`requiresHumanApproval`  
`ownerTeam`  
`operationalTags[]`  
`safetyCategory`  
`analyticsKey`

### Opcionales pero potentes

`exampleUtterances[]`  
`badAnswers[]`  
`doNotSay[]`  
`resolutionETA`  
`seasonalityWindow`  
`legalJurisdiction`  
`upsellEligibilityRule`  
`mediaPurpose`  
`mediaAltText`  
`mapPin`  
`confidenceHint`

La idea es simple: si un campo cambia cómo recuperas, cómo respondes o cuándo escalas, merece existir de forma explícita. Si no, terminará enterrado en `aiNotes` y se volverá un pantano precioso, pero pantano al fin y al cabo.