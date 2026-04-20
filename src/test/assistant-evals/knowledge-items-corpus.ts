// Hand-written corpus covering two synthetic properties (ES urban, EN beach).
// Bodies are kept tight so citation expectations are stable across pipeline
// changes — we measure retrieval+synthesis, not extraction quality.

import type { ChunkType, EntityType, JourneyStage } from "@/lib/types/knowledge";
import type { VisibilityLevel } from "@/lib/visibility";

export interface EvalKnowledgeItem {
  id: string;
  propertyId: string;
  topic: string;
  bodyMd: string;
  locale: "es" | "en";
  visibility: VisibilityLevel;
  journeyStage: JourneyStage | null;
  chunkType: ChunkType;
  entityType: EntityType;
  contextPrefix: string;
  canonicalQuestion: string;
  bm25Text: string;
  tags: string[];
}

export const EVAL_WORKSPACE_ID = "ws_eval_assistant";
export const EVAL_PROPERTY_ES = "prop_eval_es_urban";
export const EVAL_PROPERTY_EN = "prop_eval_en_beach";

// ── ES corpus (Madrid urban apartment) ──────────────────────────────────────

const ES_ITEMS: EvalKnowledgeItem[] = [
  {
    id: "ki_es_arrival_metro",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Cómo llegar en metro",
    bodyMd:
      "Desde el aeropuerto de Madrid-Barajas, toma la línea 8 de metro hasta Nuevos Ministerios y transborda a la línea 10 dirección Puerta del Sur. Baja en la estación Plaza de España. El apartamento está a 5 minutos andando.",
    locale: "es",
    visibility: "guest",
    journeyStage: "any",
    chunkType: "procedure",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España, Madrid · Cómo llegar",
    canonicalQuestion: "¿Cómo llego desde el aeropuerto?",
    bm25Text:
      "metro aeropuerto barajas linea 8 nuevos ministerios 10 plaza espana apartamento transporte llegar",
    tags: ["transporte", "metro", "aeropuerto"],
  },
  {
    id: "ki_es_arrival_taxi",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Taxi desde el aeropuerto",
    bodyMd:
      "El taxi desde Barajas hasta el apartamento tiene una tarifa plana oficial de 33 € (T.4) o 30 € (T.1-T.3). Duración aproximada: 25 minutos sin tráfico. Indica al taxista: Plaza de España, Madrid.",
    locale: "es",
    visibility: "guest",
    journeyStage: "any",
    chunkType: "fact",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España, Madrid · Taxi",
    canonicalQuestion: "¿Cuánto cuesta un taxi desde el aeropuerto?",
    bm25Text:
      "taxi aeropuerto barajas tarifa plana 33 30 euros plaza espana duracion minutos transporte",
    tags: ["transporte", "taxi"],
  },
  {
    id: "ki_es_policy_deposit",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Depósito reembolsable",
    bodyMd:
      "Se requiere un depósito de garantía de 200 € al hacer la reserva. Se devuelve íntegramente a las 48 horas del check-out si no hay incidencias.",
    locale: "es",
    visibility: "guest",
    journeyStage: "pre_arrival",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Apartamento Plaza de España · Política de depósito",
    canonicalQuestion: "¿Hay depósito de garantía?",
    bm25Text:
      "deposito garantia 200 euros reserva check-out 48 horas devolucion reembolso",
    tags: ["politica", "deposito"],
  },
  {
    id: "ki_es_checkin_hours",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Horario de check-in",
    bodyMd:
      "Check-in disponible de 15:00 a 22:00. Check-in anticipado (a partir de las 12:00) sujeto a disponibilidad con coste adicional de 20 €.",
    locale: "es",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "fact",
    entityType: "access",
    contextPrefix: "Apartamento Plaza de España · Check-in",
    canonicalQuestion: "¿A qué hora puedo hacer check-in?",
    bm25Text:
      "check-in checkin horario 15 22 horas temprano anticipado 12 20 euros llegada",
    tags: ["check-in", "horario"],
  },
  {
    id: "ki_es_access_portal_code",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Código del portal",
    bodyMd:
      "El portal del edificio se abre con el código 4827#. Marca los cuatro dígitos seguidos del símbolo almohadilla en el teclado de la puerta principal.",
    locale: "es",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "procedure",
    entityType: "access",
    contextPrefix: "Apartamento Plaza de España · Acceso al edificio",
    canonicalQuestion: "¿Cuál es el código del portal?",
    bm25Text:
      "codigo portal edificio 4827 almohadilla hashtag entrada puerta principal acceso",
    tags: ["acceso", "codigo", "portal"],
  },
  {
    id: "ki_es_access_lockbox",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Caja de seguridad de las llaves",
    bodyMd:
      "Las llaves están en una caja de seguridad junto a la puerta del apartamento (5º B). Combinación: 1847. Gira la rueda inferior a la izquierda para abrir.",
    locale: "es",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "procedure",
    entityType: "access",
    contextPrefix: "Apartamento Plaza de España · Llaves",
    canonicalQuestion: "¿Cómo consigo las llaves?",
    bm25Text:
      "llaves caja seguridad lockbox combinacion 1847 puerta 5 apartamento acceso",
    tags: ["acceso", "llaves", "lockbox"],
  },
  {
    id: "ki_es_access_late_arrival",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Llegada fuera de horario",
    bodyMd:
      "Si llegas después de las 22:00, el check-in es autónomo: usa el código del portal y la combinación de la caja de seguridad. Avísanos por WhatsApp al llegar.",
    locale: "es",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "procedure",
    entityType: "access",
    contextPrefix: "Apartamento Plaza de España · Llegada tardía",
    canonicalQuestion: "¿Qué hago si llego tarde?",
    bm25Text:
      "llegada tarde tardia fuera horario 22 autonomo codigo lockbox whatsapp",
    tags: ["acceso", "llegada-tardia"],
  },
  {
    id: "ki_es_parking",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Aparcamiento",
    bodyMd:
      "El edificio no dispone de parking privado. El parking público más cercano es Plaza de España Car Park (SABA), a 2 minutos andando. Tarifa: 30 € por día.",
    locale: "es",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Aparcamiento",
    canonicalQuestion: "¿Dónde puedo aparcar?",
    bm25Text:
      "parking aparcamiento aparcar coche plaza espana saba publico 30 euros dia",
    tags: ["parking", "aparcar"],
  },
  {
    id: "ki_es_apartment_number",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Número de apartamento",
    bodyMd:
      "El apartamento es el 5º B. Tomar el ascensor en el hall y subir a la quinta planta. Puerta B a la derecha al salir del ascensor.",
    locale: "es",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "fact",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Número",
    canonicalQuestion: "¿En qué piso está el apartamento?",
    bm25Text:
      "apartamento piso planta 5 quinta puerta b ascensor hall edificio numero",
    tags: ["apartamento", "numero"],
  },
  {
    id: "ki_es_wifi",
    propertyId: EVAL_PROPERTY_ES,
    topic: "WiFi",
    bodyMd:
      "Red: PlazaEspana_5B. Contraseña: madridwifi2024. El router está en el salón, detrás de la TV. Velocidad 600 Mbps fibra.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "fact",
    entityType: "system",
    contextPrefix: "Apartamento Plaza de España · WiFi",
    canonicalQuestion: "¿Cuál es la contraseña del WiFi?",
    bm25Text:
      "wifi internet red ssid plazaespana contrasena password madridwifi2024 router salon fibra 600",
    tags: ["wifi", "internet"],
  },
  {
    id: "ki_es_heating",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Calefacción",
    bodyMd:
      "Calefacción central por radiadores. El termostato está en el pasillo, junto a la cocina. Ajusta con las flechas arriba/abajo. Recomendado: 21°C.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "system",
    contextPrefix: "Apartamento Plaza de España · Calefacción",
    canonicalQuestion: "¿Cómo pongo la calefacción?",
    bm25Text:
      "calefaccion calor radiadores termostato pasillo cocina temperatura 21 grados central",
    tags: ["calefaccion", "temperatura"],
  },
  {
    id: "ki_es_aircon",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Aire acondicionado",
    bodyMd:
      "Aire acondicionado split en el salón y en el dormitorio principal. Usa el mando correspondiente de cada habitación. Pulsa MODE para cambiar entre frío y calor.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "system",
    contextPrefix: "Apartamento Plaza de España · Aire acondicionado",
    canonicalQuestion: "¿Cómo enciendo el aire acondicionado?",
    bm25Text:
      "aire acondicionado aa split salon dormitorio mando mode frio calor temperatura",
    tags: ["aire", "clima"],
  },
  {
    id: "ki_es_washer",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Lavadora",
    bodyMd:
      "Lavadora Bosch en el baño principal. Programa recomendado: Algodón 40°C (1 hora 30 min). Detergente en el armario bajo el fregadero de la cocina.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "amenity",
    contextPrefix: "Apartamento Plaza de España · Lavadora",
    canonicalQuestion: "¿Cómo uso la lavadora?",
    bm25Text:
      "lavadora bosch bano programa algodon 40 grados detergente armario fregadero cocina",
    tags: ["lavadora", "ropa"],
  },
  {
    id: "ki_es_oven",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Horno",
    bodyMd:
      "Horno eléctrico Balay. Gira el mando izquierdo al símbolo de resistencia superior e inferior. Ajusta la temperatura con el mando derecho. Precalienta 10 minutos antes de usar.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "amenity",
    contextPrefix: "Apartamento Plaza de España · Horno",
    canonicalQuestion: "¿Cómo uso el horno?",
    bm25Text:
      "horno electrico balay cocina resistencia temperatura precalienta mando cocinar",
    tags: ["horno", "cocina"],
  },
  {
    id: "ki_es_coffee",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Cafetera de cápsulas",
    bodyMd:
      "Cafetera Nespresso en la encimera de la cocina. Hay 20 cápsulas de cortesía en el cajón a la derecha. Llena el depósito de agua antes de usar.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "amenity",
    contextPrefix: "Apartamento Plaza de España · Cafetera",
    canonicalQuestion: "¿Cómo uso la cafetera?",
    bm25Text:
      "cafetera nespresso capsulas cafe encimera cocina deposito agua cortesia",
    tags: ["cafetera", "cafe"],
  },
  {
    id: "ki_es_tv",
    propertyId: EVAL_PROPERTY_ES,
    topic: "TV y streaming",
    bodyMd:
      "Smart TV Samsung en el salón. Netflix, HBO Max y Prime Video preinstalados. Entra con tu propia cuenta o usa las cuentas de cortesía (PIN en el cajón de la mesita).",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "fact",
    entityType: "amenity",
    contextPrefix: "Apartamento Plaza de España · TV",
    canonicalQuestion: "¿Cómo veo Netflix en la TV?",
    bm25Text:
      "tv television samsung salon netflix hbo prime video streaming cuenta pin mesita",
    tags: ["tv", "streaming"],
  },
  {
    id: "ki_es_hot_water",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Agua caliente",
    bodyMd:
      "El agua caliente viene de caldera de gas comunitaria. Si no sale agua caliente, espera 1-2 minutos tras abrir el grifo. Si persiste el problema, avisa al anfitrión.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "troubleshooting",
    entityType: "system",
    contextPrefix: "Apartamento Plaza de España · Agua caliente",
    canonicalQuestion: "¿Qué hago si no sale agua caliente?",
    bm25Text:
      "agua caliente caldera gas comunitaria no funciona sale problema averia anfitrion",
    tags: ["agua", "averia"],
  },
  {
    id: "ki_es_policy_no_smoking",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Prohibido fumar",
    bodyMd:
      "Prohibido fumar en todo el apartamento, incluido el balcón. El incumplimiento conlleva una penalización de 150 € por limpieza profunda.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Apartamento Plaza de España · Política de fumar",
    canonicalQuestion: "¿Se puede fumar?",
    bm25Text:
      "fumar prohibido no tabaco cigarro balcon 150 euros penalizacion limpieza politica",
    tags: ["politica", "fumar"],
  },
  {
    id: "ki_es_policy_no_pets",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Sin mascotas",
    bodyMd:
      "No se admiten mascotas. Excepción: perros guía con documentación acreditativa.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Apartamento Plaza de España · Mascotas",
    canonicalQuestion: "¿Puedo traer a mi perro?",
    bm25Text:
      "mascotas perro perros gato animales admitidos prohibido guia asistencia politica traer llevar puedo",
    tags: ["politica", "mascotas"],
  },
  {
    id: "ki_es_policy_noise",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Horas de silencio",
    bodyMd:
      "Horario de silencio: de 22:00 a 08:00. No se permiten fiestas ni música alta. Respeta a los vecinos del edificio.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Apartamento Plaza de España · Silencio",
    canonicalQuestion: "¿A qué hora hay que bajar el ruido?",
    bm25Text:
      "ruido silencio fiesta musica 22 08 horas noche vecinos politica convivencia",
    tags: ["politica", "ruido"],
  },
  {
    id: "ki_es_place_supermarket",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Supermercado cercano",
    bodyMd:
      "Mercadona en Calle del Conde Duque, 10 (abierto 9:00-21:30, cerrado domingos). Carrefour Express 24h en la esquina de Calle San Bernardino.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Zona · Supermercados",
    canonicalQuestion: "¿Dónde hay un supermercado?",
    bm25Text:
      "supermercado mercadona carrefour conde duque san bernardino 24h compra comida",
    tags: ["supermercado", "compras"],
  },
  {
    id: "ki_es_place_tapas",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Restaurante de tapas",
    bodyMd:
      "Casa Mingo en Paseo de la Florida, 34, especialidad pollo asado y sidra. A 10 minutos andando. Casa Labra en Calle Tetuán, 12, bacalao rebozado famoso en Madrid.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Zona · Restaurantes",
    canonicalQuestion: "¿Qué restaurante recomiendas?",
    bm25Text:
      "restaurante tapas casa mingo florida pollo asado sidra labra tetuan bacalao madrid comida",
    tags: ["restaurante", "comida"],
  },
  {
    id: "ki_es_place_pharmacy",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Farmacia 24h",
    bodyMd:
      "Farmacia 24h Gran Vía, en Gran Vía, 55, abierta todos los días. A 8 minutos andando.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Zona · Farmacia",
    canonicalQuestion: "¿Dónde hay una farmacia abierta por la noche?",
    bm25Text:
      "farmacia 24h abierta gran via medicina medicamentos noche cerca",
    tags: ["farmacia", "salud"],
  },
  {
    id: "ki_es_checkout_time",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Hora de check-out",
    bodyMd:
      "Check-out antes de las 11:00. Late check-out hasta las 13:00 disponible bajo petición y sujeto a disponibilidad (coste: 25 €).",
    locale: "es",
    visibility: "guest",
    journeyStage: "checkout",
    chunkType: "fact",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Check-out",
    canonicalQuestion: "¿A qué hora es el check-out?",
    bm25Text:
      "check-out checkout salida hora 11 13 late tardio 25 euros",
    tags: ["check-out", "horario"],
  },
  {
    id: "ki_es_checkout_keys",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Dónde dejar las llaves",
    bodyMd:
      "Deja las llaves dentro de la caja de seguridad (misma combinación 1847). Asegúrate de cerrar la puerta del apartamento con llave antes de marcharte.",
    locale: "es",
    visibility: "guest",
    journeyStage: "checkout",
    chunkType: "procedure",
    entityType: "access",
    contextPrefix: "Apartamento Plaza de España · Llaves al salir",
    canonicalQuestion: "¿Dónde dejo las llaves al irme?",
    bm25Text:
      "llaves dejar salir check-out caja seguridad lockbox 1847 puerta cerrar marcharte",
    tags: ["check-out", "llaves"],
  },
  {
    id: "ki_es_checkout_trash",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Basura y reciclaje",
    bodyMd:
      "Los contenedores están en la acera frente al portal: amarillo (plásticos), azul (papel/cartón), verde (vidrio), orgánico (marrón), resto (gris). Saca la basura antes de irte.",
    locale: "es",
    visibility: "guest",
    journeyStage: "checkout",
    chunkType: "procedure",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Basura",
    canonicalQuestion: "¿Dónde está la basura?",
    bm25Text:
      "basura reciclaje contenedores amarillo azul verde marron gris plastico papel vidrio organico donde sacar tirar saco",
    tags: ["check-out", "basura", "reciclaje"],
  },
  {
    id: "ki_es_checkout_state",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Estado para dejar el piso",
    bodyMd:
      "Deja la vajilla lavada en el escurridor, apaga todas las luces, cierra ventanas, apaga la calefacción/aire acondicionado y cierra con llave.",
    locale: "es",
    visibility: "guest",
    journeyStage: "checkout",
    chunkType: "procedure",
    entityType: "property",
    contextPrefix: "Apartamento Plaza de España · Al salir",
    canonicalQuestion: "¿Cómo debo dejar el piso al irme?",
    bm25Text:
      "dejar piso salir vajilla lavada luces apagar ventanas cerrar calefaccion aire cierre",
    tags: ["check-out", "estado"],
  },
  {
    id: "ki_es_contact_host",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Contacto del anfitrión",
    bodyMd:
      "Para cualquier problema, llama o envía WhatsApp al anfitrión Javier: +34 600 123 456. Disponible 8:00 a 22:00. Fuera de ese horario, solo emergencias.",
    locale: "es",
    visibility: "guest",
    journeyStage: "any",
    chunkType: "fact",
    entityType: "contact",
    contextPrefix: "Apartamento Plaza de España · Contacto",
    canonicalQuestion: "¿Cómo contacto con el anfitrión?",
    bm25Text:
      "contacto contactar anfitrion host javier telefono telefonear llamar escribir whatsapp 600 123 456 8 22 emergencia",
    tags: ["contacto", "anfitrion"],
  },
  {
    id: "ki_es_emergency_numbers",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Números de emergencia",
    bodyMd:
      "Emergencias generales: 112. Policía: 091. Bomberos: 080. Urgencias médicas / ambulancia: 061. El Hospital Clínico San Carlos está a 15 minutos en taxi.",
    locale: "es",
    visibility: "guest",
    journeyStage: "any",
    chunkType: "fact",
    entityType: "contact",
    contextPrefix: "Apartamento Plaza de España · Emergencias",
    canonicalQuestion: "¿Qué número llamo en emergencia?",
    bm25Text:
      "emergencia 112 policia 091 bomberos 080 ambulancia urgencias 061 hospital clinico san carlos numero telefono llamar llamo",
    tags: ["emergencia", "telefonos"],
  },
  {
    id: "ki_es_iron",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Plancha y tabla",
    bodyMd:
      "Plancha y tabla de planchar en el armario del pasillo. Llena el depósito de la plancha con agua del grifo antes de usar.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "fact",
    entityType: "amenity",
    contextPrefix: "Apartamento Plaza de España · Plancha",
    canonicalQuestion: "¿Hay plancha?",
    bm25Text:
      "plancha tabla planchar armario pasillo ropa deposito agua",
    tags: ["amenity", "plancha"],
  },
  {
    id: "ki_es_safe_internal",
    propertyId: EVAL_PROPERTY_ES,
    topic: "Caja fuerte (notas internas)",
    bodyMd:
      "Caja fuerte dentro del armario del dormitorio principal. Combinación maestra 0000 (NO compartir con huéspedes, solo uso del equipo de limpieza).",
    locale: "es",
    visibility: "internal",
    journeyStage: null,
    chunkType: "fact",
    entityType: "property",
    contextPrefix: "INTERNO · Caja fuerte",
    canonicalQuestion: "¿Cuál es la combinación de la caja fuerte?",
    bm25Text:
      "caja fuerte combinacion 0000 armario dormitorio limpieza interno",
    tags: ["interno", "caja-fuerte"],
  },
];

// ── EN corpus (Tarifa beach apartment) ──────────────────────────────────────

const EN_ITEMS: EvalKnowledgeItem[] = [
  {
    id: "ki_en_arrival_train",
    propertyId: EVAL_PROPERTY_EN,
    topic: "How to get there by train",
    bodyMd:
      "Take the train to Algeciras station, then the direct bus to Tarifa (company Comes, around 1 hour, 2.50 €). From Tarifa bus station the apartment is a 10-minute walk.",
    locale: "en",
    visibility: "guest",
    journeyStage: "pre_arrival",
    chunkType: "procedure",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · How to get here",
    canonicalQuestion: "How do I get to the apartment?",
    bm25Text:
      "train algeciras bus comes tarifa station transport travel 10 minutes walk",
    tags: ["transport", "train"],
  },
  {
    id: "ki_en_policy_deposit",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Booking deposit",
    bodyMd:
      "A 150 € refundable deposit is held at booking. Returned within 72 hours of checkout if no incidents occur.",
    locale: "en",
    visibility: "guest",
    journeyStage: "pre_arrival",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Tarifa Beach Apartment · Deposit policy",
    canonicalQuestion: "Is there a deposit?",
    bm25Text:
      "deposit 150 euros booking refundable 72 hours checkout incidents return",
    tags: ["policy", "deposit"],
  },
  {
    id: "ki_en_checkin_hours",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Check-in hours",
    bodyMd: "Check-in from 16:00 to 21:00. Self check-in available 24/7 via keybox.",
    locale: "en",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "fact",
    entityType: "access",
    contextPrefix: "Tarifa Beach Apartment · Check-in",
    canonicalQuestion: "What time is check-in?",
    bm25Text: "check-in checkin hours 16 21 self keybox 24 7 arrival time",
    tags: ["check-in", "hours"],
  },
  {
    id: "ki_en_access_keybox",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Keybox code",
    bodyMd:
      "The keybox is attached to the metal railing next to the entrance. Code: 7391. Slide the cover down, enter the code, then pull the hook forward.",
    locale: "en",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "procedure",
    entityType: "access",
    contextPrefix: "Tarifa Beach Apartment · Keybox",
    canonicalQuestion: "How do I get the keys?",
    bm25Text: "keybox lockbox code 7391 railing entrance keys access cover slide",
    tags: ["access", "keybox"],
  },
  {
    id: "ki_en_access_late",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Late arrival",
    bodyMd:
      "If you arrive after 21:00, check-in is self-service via the keybox. Please send us a WhatsApp message when you arrive so we know you're in.",
    locale: "en",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "procedure",
    entityType: "access",
    contextPrefix: "Tarifa Beach Apartment · Late arrival",
    canonicalQuestion: "What if I arrive late?",
    bm25Text: "late arrival after 21 self check-in keybox whatsapp message",
    tags: ["access", "late"],
  },
  {
    id: "ki_en_access_building",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Building entry",
    bodyMd:
      "The apartment is on the ground floor (door number 3). No lift needed — straight down the corridor on the right from the main entrance.",
    locale: "en",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "fact",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · Building",
    canonicalQuestion: "Which door is the apartment?",
    bm25Text: "building entry apartment ground floor door 3 corridor right entrance",
    tags: ["access", "building"],
  },
  {
    id: "ki_en_parking",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Beach parking",
    bodyMd:
      "Free street parking along Avenida de Andalucía, usually available. Paid parking lot Los Lances next to the beach for 8 € per day.",
    locale: "en",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · Parking",
    canonicalQuestion: "Where can I park?",
    bm25Text: "parking car street free andalucia los lances lot paid beach 8 euros",
    tags: ["parking"],
  },
  {
    id: "ki_en_wifi",
    propertyId: EVAL_PROPERTY_EN,
    topic: "WiFi",
    bodyMd:
      "Network: TarifaBeach_GF. Password: surfwaves2024. Router is in the living room cabinet. Speed 300 Mbps.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "fact",
    entityType: "system",
    contextPrefix: "Tarifa Beach Apartment · WiFi",
    canonicalQuestion: "What is the WiFi password?",
    bm25Text:
      "wifi internet network ssid tarifabeach password surfwaves2024 router living room 300",
    tags: ["wifi", "internet"],
  },
  {
    id: "ki_en_aircon",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Air conditioning",
    bodyMd:
      "Split air conditioning in the bedroom and living room. Use the remote for each unit; press MODE to toggle cool/heat, arrows for temperature.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "system",
    contextPrefix: "Tarifa Beach Apartment · A/C",
    canonicalQuestion: "How do I turn on the air conditioning?",
    bm25Text:
      "air conditioning ac split bedroom living room remote mode cool heat temperature",
    tags: ["aircon", "climate"],
  },
  {
    id: "ki_en_hot_water",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Hot water (solar heater)",
    bodyMd:
      "Hot water comes from a solar heater on the roof, with an electric backup in the utility closet. If no hot water after 3 minutes, check the utility closet switch is on. On cloudy winter days the backup takes over automatically.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "troubleshooting",
    entityType: "system",
    contextPrefix: "Tarifa Beach Apartment · Hot water",
    canonicalQuestion: "Why is there no hot water?",
    bm25Text:
      "hot water solar heater roof cloudy electric backup switch utility closet troubleshooting",
    tags: ["water", "troubleshoot"],
  },
  {
    id: "ki_en_washer",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Washing machine",
    bodyMd:
      "Bosch washing machine in the bathroom. Recommended program: Cotton 40°C (1h30). Detergent under the kitchen sink.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "amenity",
    contextPrefix: "Tarifa Beach Apartment · Washer",
    canonicalQuestion: "How do I use the washing machine?",
    bm25Text:
      "washing machine washer bosch bathroom cotton 40 program detergent kitchen sink clothes",
    tags: ["washer", "laundry"],
  },
  {
    id: "ki_en_dishwasher",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Dishwasher",
    bodyMd:
      "Dishwasher under the kitchen counter. Tablets in the top drawer. Program 3 (eco) is enough for normal loads.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "amenity",
    contextPrefix: "Tarifa Beach Apartment · Dishwasher",
    canonicalQuestion: "Is there a dishwasher?",
    bm25Text:
      "dishwasher kitchen counter tablets drawer program 3 eco loads dishes",
    tags: ["dishwasher"],
  },
  {
    id: "ki_en_coffee",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Coffee maker",
    bodyMd:
      "Nespresso machine on the kitchen counter. 15 complimentary capsules in the right drawer. Fill the water tank before brewing.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "procedure",
    entityType: "amenity",
    contextPrefix: "Tarifa Beach Apartment · Coffee",
    canonicalQuestion: "How do I make coffee?",
    bm25Text:
      "coffee nespresso capsules machine kitchen counter drawer complimentary water tank brewing",
    tags: ["coffee"],
  },
  {
    id: "ki_en_tv_netflix",
    propertyId: EVAL_PROPERTY_EN,
    topic: "TV and Netflix",
    bodyMd:
      "Samsung Smart TV in the living room. Netflix and Amazon Prime Video preinstalled. Sign in with your own account or use the guest account (PIN inside the TV remote drawer).",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "fact",
    entityType: "amenity",
    contextPrefix: "Tarifa Beach Apartment · TV",
    canonicalQuestion: "Can I watch Netflix?",
    bm25Text: "tv television samsung living room netflix amazon prime video streaming account pin",
    tags: ["tv", "streaming"],
  },
  {
    id: "ki_en_policy_smoking",
    propertyId: EVAL_PROPERTY_EN,
    topic: "No smoking indoors",
    bodyMd:
      "No smoking anywhere inside the apartment. Smoking is allowed on the balcony only. Violations incur a 100 € deep-cleaning fee.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Tarifa Beach Apartment · Smoking policy",
    canonicalQuestion: "Can I smoke in the apartment?",
    bm25Text:
      "smoking no cigarette indoors balcony allowed 100 euros cleaning fee policy",
    tags: ["policy", "smoking"],
  },
  {
    id: "ki_en_policy_pets",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Pet policy",
    bodyMd:
      "Small dogs (under 15 kg) are welcome with a 40 € pet fee. Must be declared at booking. Larger pets not accepted.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Tarifa Beach Apartment · Pet policy",
    canonicalQuestion: "Can I bring my dog?",
    bm25Text:
      "pets dog small 15 kg fee 40 euros booking policy animals large",
    tags: ["policy", "pets"],
  },
  {
    id: "ki_en_policy_parties",
    propertyId: EVAL_PROPERTY_EN,
    topic: "No parties",
    bodyMd:
      "No parties or events allowed. Quiet hours 23:00–08:00. Exceeding 6 guests in the apartment at any time is not permitted.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "policy",
    entityType: "policy",
    contextPrefix: "Tarifa Beach Apartment · Parties",
    canonicalQuestion: "Can I throw a party?",
    bm25Text:
      "party parties events quiet hours 23 08 noise 6 guests maximum policy",
    tags: ["policy", "noise"],
  },
  {
    id: "ki_en_beach_towels",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Beach towels",
    bodyMd:
      "Two beach towels are provided in the closet by the front door. Please don't use bath towels on the beach — there's a 20 € fee per stained/lost towel.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "fact",
    entityType: "amenity",
    contextPrefix: "Tarifa Beach Apartment · Beach towels",
    canonicalQuestion: "Are beach towels provided?",
    bm25Text:
      "beach towels provided closet front door bath 20 euros fee lost stained",
    tags: ["beach", "towels"],
  },
  {
    id: "ki_en_place_beach",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Closest beach",
    bodyMd:
      "Playa de los Lances is 3 minutes walk. Long sandy beach, ideal for families. Playa Valdevaqueros (10 min by car) is better for windsurfing and kitesurfing.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · Beaches",
    canonicalQuestion: "Where is the closest beach?",
    bm25Text:
      "beach playa los lances 3 minutes walk valdevaqueros 10 drive windsurf kitesurf sand",
    tags: ["beach", "place"],
  },
  {
    id: "ki_en_place_windsurf",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Windsurfing school",
    bodyMd:
      "Tarifa Wind School at Playa Valdevaqueros offers windsurf and kitesurf lessons from 60 €. Book a day ahead by phone.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · Windsurf school",
    canonicalQuestion: "Where can I learn windsurfing?",
    bm25Text:
      "windsurfing kitesurfing kitesurf surf school tarifa wind valdevaqueros lessons learn classes 60 euros booking",
    tags: ["activity", "windsurf"],
  },
  {
    id: "ki_en_place_restaurant",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Restaurant recommendation",
    bodyMd:
      "Mandrágora at Calle Independencia, 3 — excellent Moroccan-Andalusian fusion. Book ahead. El Lola for tapas and flamenco on Thursdays.",
    locale: "en",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "place",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · Restaurants",
    canonicalQuestion: "Where should I eat?",
    bm25Text:
      "restaurant restaurants mandragora independencia moroccan andalusian fusion lola tapas flamenco thursday dinner tarifa recommend eat good",
    tags: ["restaurant", "food"],
  },
  {
    id: "ki_en_checkout_time",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Checkout time",
    bodyMd:
      "Checkout by 11:00. Late checkout until 13:00 on request, subject to availability (15 € fee).",
    locale: "en",
    visibility: "guest",
    journeyStage: "checkout",
    chunkType: "fact",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · Checkout",
    canonicalQuestion: "What time is checkout?",
    bm25Text: "checkout check-out time 11 13 late fee 15 euros availability",
    tags: ["checkout"],
  },
  {
    id: "ki_en_checkout_keys",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Key return",
    bodyMd:
      "Put the keys back in the keybox (same code 7391). Close the apartment door firmly — it locks automatically.",
    locale: "en",
    visibility: "guest",
    journeyStage: "checkout",
    chunkType: "procedure",
    entityType: "access",
    contextPrefix: "Tarifa Beach Apartment · Key return",
    canonicalQuestion: "Where do I leave the keys?",
    bm25Text: "keys return keybox code 7391 checkout door automatic lock leave",
    tags: ["checkout", "keys"],
  },
  {
    id: "ki_en_checkout_trash",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Trash and recycling",
    bodyMd:
      "Bins are at the corner of Calle Batalla del Salado: yellow (plastics), blue (paper), green (glass), grey (general). Please empty the kitchen bin before leaving.",
    locale: "en",
    visibility: "guest",
    journeyStage: "checkout",
    chunkType: "procedure",
    entityType: "property",
    contextPrefix: "Tarifa Beach Apartment · Trash",
    canonicalQuestion: "Where do I put the trash?",
    bm25Text:
      "trash bin recycling yellow plastic blue paper green glass grey general salado kitchen",
    tags: ["checkout", "trash"],
  },
  {
    id: "ki_en_contact_host",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Host contact",
    bodyMd:
      "Contact the host Maria by WhatsApp at +34 611 222 333. Available 9:00–22:00. Outside those hours only for emergencies.",
    locale: "en",
    visibility: "guest",
    journeyStage: "any",
    chunkType: "fact",
    entityType: "contact",
    contextPrefix: "Tarifa Beach Apartment · Host",
    canonicalQuestion: "How do I contact the host?",
    bm25Text: "contact host maria whatsapp 611 222 333 9 22 hours emergency",
    tags: ["contact", "host"],
  },
  {
    id: "ki_en_emergency",
    propertyId: EVAL_PROPERTY_EN,
    topic: "Emergency numbers",
    bodyMd:
      "General emergency: 112 (police, fire, ambulance). Medical urgencies: 061. The closest hospital is Hospital Punta de Europa in Algeciras, 20 minutes by car.",
    locale: "en",
    visibility: "guest",
    journeyStage: "any",
    chunkType: "fact",
    entityType: "contact",
    contextPrefix: "Tarifa Beach Apartment · Emergency",
    canonicalQuestion: "What number do I call in an emergency?",
    bm25Text:
      "emergency 112 police fire ambulance 061 medical hospital punta europa algeciras 20 minutes",
    tags: ["emergency"],
  },
];

export const EVAL_KNOWLEDGE_ITEMS: readonly EvalKnowledgeItem[] = [
  ...ES_ITEMS,
  ...EN_ITEMS,
];

export const EVAL_PROPERTIES = [
  {
    id: EVAL_PROPERTY_ES,
    workspaceId: EVAL_WORKSPACE_ID,
    propertyNickname: "Eval · Plaza de España",
    defaultLocale: "es",
    country: "ES",
    city: "Madrid",
    timezone: "Europe/Madrid",
  },
  {
    id: EVAL_PROPERTY_EN,
    workspaceId: EVAL_WORKSPACE_ID,
    propertyNickname: "Eval · Tarifa Beach",
    defaultLocale: "en",
    country: "ES",
    city: "Tarifa",
    timezone: "Europe/Madrid",
  },
] as const;
