import { asPolicies } from "./policies-shape";

export interface RenderHouseRulesOptions {
  /**
   * When true, append a commercial-photography line if the policy is
   * `with_permission`. Platforms without a structured bool for this concept
   * (Booking) fold it into the free-text. Airbnb has a structured
   * `listing_policies.commercial_photography_allowed` and omits it here.
   */
  includeCommercialPhotography?: boolean;
}

export function renderHouseRules(
  policies: Record<string, unknown> | null,
  options: RenderHouseRulesOptions = {},
): string | null {
  if (!policies) return null;
  const p = asPolicies(policies);
  const lines: string[] = [];

  if (p.quietHours?.enabled && p.quietHours.from && p.quietHours.to) {
    lines.push(`Horas de silencio: ${p.quietHours.from}–${p.quietHours.to}.`);
  }

  if (p.smoking === "not_allowed") lines.push("No fumar dentro del alojamiento.");
  else if (p.smoking === "outdoors_only") lines.push("Fumar permitido solo en exterior.");
  else if (p.smoking === "designated_area") lines.push("Fumar permitido solo en zona designada.");

  if (p.events?.policy === "not_allowed") lines.push("No se permiten fiestas ni eventos.");
  else if (p.events?.policy === "small_gatherings" && typeof p.events.maxPeople === "number") {
    lines.push(`Reuniones pequeñas permitidas (máximo ${p.events.maxPeople} personas).`);
  } else if (p.events?.policy === "with_approval") {
    lines.push("Eventos permitidos solo con aprobación previa.");
  }

  if (p.pets?.allowed === false) lines.push("No se admiten mascotas.");

  if (p.services?.allowed === false) lines.push("Servicios externos en el alojamiento no permitidos.");

  if (options.includeCommercialPhotography && p.commercialPhotography === "with_permission") {
    lines.push("Fotografía comercial permitida solo con permiso previo.");
  }

  return lines.length === 0 ? null : lines.join(" ");
}
