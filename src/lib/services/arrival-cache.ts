import { z } from "zod";
import {
  ARRIVAL_MODES,
  type ArrivalMode,
  type ArrivalSuggestion,
} from "@/lib/services/arrival-discovery.service";
import { ProviderMetadataSchema } from "@/lib/services/places/provider";

export type ArrivalModesEnabledMap = Partial<
  Record<(typeof ARRIVAL_MODES)[number] | "parking", boolean>
>;

// Pinned shape for cached arrival suggestions. Mirrors `ArrivalSuggestion` from
// arrival-discovery.service.ts — keep in sync. Validating at the cache boundary
// stops legacy/tampered rows from leaking `distanceMeters: undefined` (or any
// other partial shape) into the confirm path, which would otherwise persist
// misleading 0m distances on the LocalPlace row.
const ArrivalSuggestionSchema = z
  .object({
    provider: z.string().min(1),
    providerPlaceId: z.string().min(1),
    name: z.string().min(1),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    address: z.string().nullable(),
    website: z.string().nullable(),
    distanceMeters: z.number().int().min(0),
    providerMetadata: ProviderMetadataSchema,
  })
  .strict();

export function readArrivalCache(
  raw: unknown,
): Partial<Record<ArrivalMode, ArrivalSuggestion[]>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<ArrivalMode, ArrivalSuggestion[]>> = {};
  const allowed = new Set<string>(ARRIVAL_MODES);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(k) || !Array.isArray(v)) continue;
    const validated: ArrivalSuggestion[] = [];
    for (const item of v) {
      const parsed = ArrivalSuggestionSchema.safeParse(item);
      if (parsed.success) validated.push(parsed.data);
    }
    out[k as ArrivalMode] = validated;
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

