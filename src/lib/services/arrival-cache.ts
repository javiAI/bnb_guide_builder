import {
  ARRIVAL_MODES,
  type ArrivalMode,
  type ArrivalSuggestion,
} from "@/lib/services/arrival-discovery.service";

export type ArrivalModesEnabledMap = Partial<
  Record<(typeof ARRIVAL_MODES)[number] | "parking", boolean>
>;

export function readArrivalCache(
  raw: unknown,
): Partial<Record<ArrivalMode, ArrivalSuggestion[]>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<ArrivalMode, ArrivalSuggestion[]>> = {};
  const allowed = new Set<string>(ARRIVAL_MODES);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (allowed.has(k) && Array.isArray(v)) {
      out[k as ArrivalMode] = v as ArrivalSuggestion[];
    }
  }
  return out;
}

export function parseModesMap(raw: unknown): ArrivalModesEnabledMap {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set<string>([...ARRIVAL_MODES, "parking"]);
  const out: ArrivalModesEnabledMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (allowed.has(k) && typeof v === "boolean") {
      out[k as keyof ArrivalModesEnabledMap] = v;
    }
  }
  return out;
}

