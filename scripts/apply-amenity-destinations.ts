/**
 * apply-amenity-destinations.ts
 *
 * Source of truth for the amenity audit (branch 1B, see docs/MASTER_PLAN.md).
 *
 * Applies `destination` (+ optional `target`) to every item in
 * `taxonomies/amenity_taxonomy.json`, seeded from the audit table at
 * `docs/deep_research_2/amenities_arquitecture.md` § "Auditoría completa
 * del catálogo actual" (originally 142 items; extended in branch 7B with
 * 8 additions from the "Propuesta de additions" section of the same doc,
 * bringing the total to 150).
 *
 * Idempotent: running twice produces byte-identical output.
 *
 * Usage:
 *   npm run apply-amenity-destinations
 *
 * Note: this runs through the project-pinned `tsx` devDependency so the
 * version is reproducible across machines and CI. A direct `tsc && node`
 * pipeline is avoided because this script relies on `import.meta.url`
 * (ESM-only), while the repo's `package.json` does not set `"type":
 * "module"`, so an emitted `.js` would be treated as CommonJS and fail
 * to run.
 *
 * Also emits `taxonomies/amenity_destinations_summary.json` as a
 * lightweight audit snapshot for PR review.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AmenityDestination } from "../src/lib/types/taxonomy";

export interface AmenityDestinationEntry {
  id: string;
  destination: AmenityDestination;
  target?: string;
  /** Human-readable migration note from the audit table. Not written to the taxonomy JSON; emitted in the generated summary snapshot for PR review. */
  note?: string;
}

/**
 * The canonical 150-item audit mapping (142 original + 8 branch 7B additions).
 * DO NOT edit by hand — sourced from the research doc. Changes must be
 * reflected in `docs/deep_research_2/amenities_arquitecture.md` first.
 */
export const DESTINATIONS: ReadonlyArray<AmenityDestinationEntry> = [
  { id: "am.wifi", destination: "derived_from_system", target: "sys.internet", note: "La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada." },
  { id: "am.kitchen", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.air_conditioning", destination: "derived_from_system", target: "sys.cooling", note: "La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada." },
  { id: "am.washer", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.free_parking", destination: "derived_from_access", target: "parking_options", note: "Se deriva desde la configuración de parking del módulo Access para export OTA." },
  { id: "am.iron", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.bathtub", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.bidet", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.body_soap", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.cleaning_products", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.conditioner", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.hair_dryer", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.hot_water", destination: "derived_from_system", target: "sys.hot_water", note: "La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada." },
  { id: "am.outdoor_shower", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.shampoo", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.shower_gel", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.bed_linens", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.clothing_storage", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.dryer", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.drying_rack", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.essentials", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.extra_pillows_blankets", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.hangers", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.mosquito_net", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.room_darkening_shades", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.safe", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.arcade_games", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.batting_cage", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.books_reading", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.bowling_alley", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.climbing_wall", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.ethernet", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.exercise_equipment", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.game_console", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.laser_tag", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.life_size_games", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.mini_golf", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.movie_theater", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.piano", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.ping_pong", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.pool_table", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.record_player", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.skate_ramp", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.sound_system", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.theme_room", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.tv", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.baby_bath", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.baby_monitor", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.baby_safety_gates", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.babysitter_recs", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.board_games", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.changing_table", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.childrens_playroom", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.childrens_bikes", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.childrens_books_toys", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.childrens_dinnerware", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.crib", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.fire_screen", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.high_chair", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.outdoor_playground", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.outlet_covers", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.pack_n_play", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.table_corner_guards", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.window_guards", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.ceiling_fan", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.heating", destination: "derived_from_system", target: "sys.heating", note: "La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada." },
  { id: "am.indoor_fireplace", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.portable_fans", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.co_alarm", destination: "moved_to_system", target: "sys.co_detector", note: "Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks." },
  { id: "am.fire_extinguisher", destination: "moved_to_system", target: "sys.fire_extinguisher", note: "Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks." },
  { id: "am.first_aid_kit", destination: "moved_to_system", target: "sys.first_aid_kit", note: "Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks." },
  { id: "am.smoke_alarm", destination: "moved_to_system", target: "sys.smoke_detector", note: "Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks." },
  { id: "am.dedicated_workspace", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.pocket_wifi", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.baking_sheet", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.bbq_utensils", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.blender", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.bread_maker", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.coffee", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.coffee_maker", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.cooking_basics", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.dining_table", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.dishes_silverware", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.dishwasher", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.freezer", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.kettle", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.kitchenette", destination: "derived_from_space", target: "sp.studio|sp.loft", note: "Es tipo/layout de cocina, no inventario; se deriva por spaceType/features." },
  { id: "am.microwave", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.mini_fridge", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.oven", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.refrigerator", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.rice_maker", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.stove", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.toaster", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.trash_compactor", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.wine_glasses", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.beach_access", destination: "moved_to_property_attribute", target: "env.beach", note: "Atributo de ubicación/entorno; se captura como propertyEnvironment." },
  { id: "am.lake_access", destination: "moved_to_property_attribute", target: "env.lake", note: "Atributo de ubicación/entorno; se captura como propertyEnvironment." },
  { id: "am.laundromat_nearby", destination: "moved_to_guide_content", target: "local_guide", note: "Es recomendación/guía local, no equipamiento." },
  { id: "am.private_entrance", destination: "moved_to_property_attribute", target: "Property.hasPrivateEntrance", note: "Atributo estructural de privacidad/acceso; campo booleano en Property." },
  { id: "am.resort_access", destination: "moved_to_property_attribute", target: "env.resort", note: "Atributo de ubicación/entorno; se captura como propertyEnvironment." },
  { id: "am.ski_in_out", destination: "moved_to_property_attribute", target: "env.ski", note: "Atributo de ubicación/entorno; se captura como propertyEnvironment." },
  { id: "am.waterfront", destination: "moved_to_property_attribute", target: "env.waterfront", note: "Atributo de ubicación/entorno; se captura como propertyEnvironment." },
  { id: "am.backyard", destination: "derived_from_space", target: "sp.garden", note: "Existe si hay espacio exterior (patio/jardín); no es equipamiento." },
  { id: "am.bbq_grill", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.beach_essentials", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.bikes", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.boat_slip", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.fire_pit", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.hammock", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.kayak", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.outdoor_dining_area", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.outdoor_furniture", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.outdoor_kitchen", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.patio_balcony", destination: "derived_from_space", target: "sp.balcony|sp.patio", note: "Se deriva de la existencia de balcón/patio; no es un item de inventario." },
  { id: "am.sun_loungers", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.elevator", destination: "derived_from_system", target: "sys.elevator", note: "Debe derivarse del System sys.elevator (infraestructura edificio)." },
  { id: "am.ev_charger", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.free_parking_premises", destination: "moved_to_access", target: "pk.free_on_premises", note: "Se modela como opción de parking en Access (parking_options), no como amenity." },
  { id: "am.free_street_parking", destination: "moved_to_access", target: "pk.free_street", note: "Se modela como opción de parking en Access (parking_options), no como amenity." },
  { id: "am.gym", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.hockey_rink", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.hot_tub", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.paid_parking_off_premises", destination: "moved_to_access", target: "pk.paid_off_premises", note: "Se modela como opción de parking en Access (parking_options), no como amenity." },
  { id: "am.paid_parking_on_premises", destination: "moved_to_access", target: "pk.paid_on_premises", note: "Se modela como opción de parking en Access (parking_options), no como amenity." },
  { id: "am.pool", destination: "derived_from_space", note: "Derivado de espacios/features (no se captura en PropertyAmenityInstance)." },
  { id: "am.private_living_room", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.sauna", destination: "amenity_configurable", note: "Amenity configurable (inventario/experiencia)." },
  { id: "am.single_level_home", destination: "moved_to_access", target: "ax.single_level_home", note: "Es atributo de accesibilidad (no equipamiento)." },
  { id: "ax.step_free_guest_entrance", destination: "moved_to_access", target: "ax.step_free_guest_entrance", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.guest_entrance_wide_81cm", destination: "moved_to_access", target: "ax.guest_entrance_wide_81cm", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.accessible_parking_spot", destination: "moved_to_access", target: "ax.accessible_parking_spot", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.step_free_path_to_entrance", destination: "moved_to_access", target: "ax.step_free_path_to_entrance", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.step_free_bedroom_access", destination: "moved_to_access", target: "ax.step_free_bedroom_access", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.bedroom_entrance_wide_81cm", destination: "moved_to_access", target: "ax.bedroom_entrance_wide_81cm", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.step_free_bathroom_access", destination: "moved_to_access", target: "ax.step_free_bathroom_access", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.bathroom_entrance_wide_81cm", destination: "moved_to_access", target: "ax.bathroom_entrance_wide_81cm", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.shower_grab_bar", destination: "moved_to_access", target: "ax.shower_grab_bar", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.toilet_grab_bar", destination: "moved_to_access", target: "ax.toilet_grab_bar", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.step_free_shower", destination: "moved_to_access", target: "ax.step_free_shower", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.shower_bath_chair", destination: "moved_to_access", target: "ax.shower_bath_chair", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "ax.ceiling_mobile_hoist", destination: "moved_to_access", target: "ax.ceiling_mobile_hoist", note: "accessibility_feature (ax.*) capturado en Acceso/Accesibilidad, no como amenity." },
  { id: "am.hand_soap", destination: "amenity_configurable", note: "Jabón de manos baños/cocina — configurable como amenity." },
  { id: "am.dish_soap", destination: "amenity_configurable", note: "Lavavajillas a mano — configurable en cocina." },
  { id: "am.laundry_detergent", destination: "amenity_configurable", note: "Detergente lavadora — configurable cuando hay washer." },
  { id: "am.air_purifier", destination: "amenity_configurable", note: "Purificador de aire — configurable según el espacio." },
  { id: "am.humidifier", destination: "amenity_configurable", note: "Humidificador — configurable según clima." },
  { id: "am.dehumidifier", destination: "amenity_configurable", note: "Deshumidificador — configurable según el espacio y el entorno (p. ej., costero o montañoso)." },
  { id: "am.cork_screw", destination: "amenity_configurable", note: "Sacacorchos — configurable en cocina." },
  { id: "am.basic_spices", destination: "amenity_configurable", note: "Especias básicas — desagregado de cooking_basics." },
];

interface AmenityItemRaw {
  id: string;
  destination?: AmenityDestination;
  target?: string;
  [key: string]: unknown;
}

interface AmenityTaxonomyFile {
  items: AmenityItemRaw[];
  [key: string]: unknown;
}

/**
 * Apply `DESTINATIONS` to the loaded taxonomy object in place.
 * - Preserves insertion order of existing keys.
 * - For each item: sets `destination`; sets `target` if present; deletes
 *   `target` if destination has none.
 * - Throws if there's a mismatch between taxonomy and mapping (count/ids).
 */
export function applyDestinations(taxonomy: AmenityTaxonomyFile): {
  updated: number;
  summary: Array<{
    id: string;
    destination: AmenityDestination;
    target?: string;
    note?: string;
  }>;
} {
  const byId = new Map<string, AmenityDestinationEntry>(
    DESTINATIONS.map((d) => [d.id, d]),
  );

  // Integrity checks
  const taxIds = new Set(taxonomy.items.map((i) => i.id));
  const mapIds = new Set(DESTINATIONS.map((d) => d.id));
  const missingInMap = [...taxIds].filter((id) => !mapIds.has(id));
  const missingInTax = [...mapIds].filter((id) => !taxIds.has(id));
  if (missingInMap.length || missingInTax.length) {
    throw new Error(
      `Mismatch between amenity taxonomy and audit mapping.\n` +
        `  in taxonomy not in audit: ${JSON.stringify(missingInMap)}\n` +
        `  in audit not in taxonomy: ${JSON.stringify(missingInTax)}`,
    );
  }

  let updated = 0;
  for (const item of taxonomy.items) {
    const entry = byId.get(item.id);
    if (!entry) continue; // impossible given check above
    const prevDest = item.destination;
    const prevTarget = item.target;
    item.destination = entry.destination;
    if (entry.target) {
      item.target = entry.target;
    } else if ("target" in item) {
      delete item.target;
    }
    if (prevDest !== item.destination || prevTarget !== item.target) updated++;
  }

  const summary = [...DESTINATIONS]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({
      id: d.id,
      destination: d.destination,
      ...(d.target ? { target: d.target } : {}),
      ...(d.note ? { note: d.note } : {}),
    }));

  return { updated, summary };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const taxonomyPath = path.join(repoRoot, "taxonomies/amenity_taxonomy.json");
  const summaryPath = path.join(
    repoRoot,
    "taxonomies/amenity_destinations_summary.json",
  );

  const raw = await fs.readFile(taxonomyPath, "utf8");
  const taxonomy = JSON.parse(raw) as AmenityTaxonomyFile;
  const { updated, summary } = applyDestinations(taxonomy);

  const out = JSON.stringify(taxonomy, null, 2) + "\n";
  await fs.writeFile(taxonomyPath, out, "utf8");

  const summaryFile = {
    file: "amenity_destinations_summary.json",
    generator: "scripts/apply-amenity-destinations.ts",
    source: "docs/deep_research_2/amenities_arquitecture.md",
    total: summary.length,
    countsByDestination: summary.reduce<Record<string, number>>((acc, r) => {
      acc[r.destination] = (acc[r.destination] ?? 0) + 1;
      return acc;
    }, {}),
    items: summary,
  };
  await fs.writeFile(
    summaryPath,
    JSON.stringify(summaryFile, null, 2) + "\n",
    "utf8",
  );

  // eslint-disable-next-line no-console
  console.log(
    `applied ${DESTINATIONS.length} destinations (${updated} changed). summary → ${path.relative(repoRoot, summaryPath)}`,
  );
}

// CLI entry: only runs when executed directly, not when imported.
const isDirectRun =
  typeof import.meta.url === "string" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
