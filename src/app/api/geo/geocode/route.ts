import { NextRequest, NextResponse } from "next/server";
import { find as findTimezone } from "geo-tz";
import { inferProvince } from "@/lib/province-utils";
import { CP_PROVINCE_MAP } from "@/lib/cp-province-map";

const MAPTILER_API_KEY = process.env.MAPTILER_API_KEY;
const GEOCODE_BASE = "https://api.maptiler.com/geocoding";

interface MtFeature {
  center?: [number, number];
  geometry?: { coordinates?: [number, number] };
  bbox?: [number, number, number, number];
  place_name?: string;
  text?: string;
  place_type?: string[];
  properties?: { postcode?: string };
  context?: Array<{ id?: string; text?: string; short_code?: string }>;
}

async function mtGeocode(query: string, params: Record<string, string>): Promise<MtFeature[]> {
  const qs = new URLSearchParams({ key: MAPTILER_API_KEY!, language: "es", ...params });
  const res = await fetch(`${GEOCODE_BASE}/${encodeURIComponent(query)}.json?${qs.toString()}`);
  if (!res.ok) throw new Error(`maptiler ${res.status}`);
  const data = await res.json();
  return (data.features ?? []) as MtFeature[];
}

function centerOf(f: MtFeature): [number, number] | null {
  const c = f.center ?? f.geometry?.coordinates;
  if (!c || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
  return [c[0], c[1]];
}

function inBbox(lng: number, lat: number, b: [number, number, number, number]): boolean {
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
}

/**
 * Forward geocoding, constrained to the operator's city.
 *
 * The naive single free-text query ("Calle X, Teruel, España" + limit=1) lets
 * MapTiler pick the highest-relevance match anywhere — a street with the same
 * name in another municipality of the same province wins (e.g. Mazaleón instead
 * of Teruel city). To make it deterministic to the city we geocode in two steps:
 *   1. geocode "{city}, {country}" (city-level types) → its bbox + center +
 *      country ISO;
 *   2. geocode the street with `bbox` + `proximity` + `country`, so results can
 *      only land inside the city. If no street matches inside the city we fall
 *      back to the city centre (right city, no street precision) rather than a
 *      wrong village.
 */
export async function POST(request: NextRequest) {
  if (!MAPTILER_API_KEY) {
    return NextResponse.json({ error: "Geocoding no configurado", matchFound: false }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido", matchFound: false }, { status: 400 });
  }
  const streetAddress = typeof body.streetAddress === "string" ? body.streetAddress.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";

  // City + country are mandatory anchors — without them the search can't be
  // constrained and would drift. (The UI gates the button on the same fields.)
  if (!city || !country) {
    return NextResponse.json({ error: "Faltan país y ciudad", matchFound: false }, { status: 400 });
  }

  try {
    // ── Step 1: locate the city ────────────────────────────────────────────
    const cityFeatures = await mtGeocode(`${city}, ${country}`, {
      limit: "1",
      types: "municipality,municipal_district,place,locality",
    });
    const cityFeature = cityFeatures[0];
    const cityCenter = cityFeature ? centerOf(cityFeature) : null;
    if (!cityFeature || !cityCenter) {
      return NextResponse.json({ matchFound: false, query: `${city}, ${country}`, reason: "city_not_found" });
    }
    const countryIso = cityFeature.context?.find((c) => (c.id ?? "").startsWith("country"))?.short_code;
    // City bbox, or a ~12 km box around the centre when the provider omits it.
    const cityBbox: [number, number, number, number] =
      cityFeature.bbox ?? [cityCenter[0] - 0.12, cityCenter[1] - 0.1, cityCenter[0] + 0.12, cityCenter[1] + 0.1];

    // ── Step 2: locate the street, constrained to the city ─────────────────
    let lng: number | null = null;
    let lat: number | null = null;
    let matchedFeature: MtFeature | null = null;
    let precision: "address" | "city" = "city";

    if (streetAddress) {
      const params: Record<string, string> = {
        limit: "5",
        proximity: `${cityCenter[0]},${cityCenter[1]}`,
        bbox: cityBbox.join(","),
      };
      if (countryIso) params.country = countryIso;
      const streetFeatures = await mtGeocode(streetAddress, params);
      const within = streetFeatures.find((f) => {
        const c = centerOf(f);
        return c ? inBbox(c[0], c[1], cityBbox) : false;
      });
      if (within) {
        const c = centerOf(within)!;
        [lng, lat] = c;
        matchedFeature = within;
        precision = "address";
      }
    }

    // Fallback: no street match inside the city → drop the pin on the city centre.
    if (lat == null || lng == null) {
      [lng, lat] = cityCenter;
      matchedFeature = cityFeature;
      precision = "city";
    }

    // ── Derive postal code / province / timezone from the resolved point ────
    const context = matchedFeature?.context ?? [];
    let derivedPostalCode: string | null = null;
    let derivedProvince: string | null = null;
    let derivedCity: string | null = null;
    let derivedCountry: string | null = null;
    for (const ctx of context) {
      const ctxId = ctx.id ?? "";
      if (ctxId.startsWith("postcode")) derivedPostalCode = ctx.text ?? null;
      if (ctxId.startsWith("region") || ctxId.startsWith("province")) derivedProvince = ctx.text ?? null;
      if (ctxId.startsWith("place") || ctxId.startsWith("municipality")) derivedCity = ctx.text ?? null;
      if (ctxId.startsWith("country")) derivedCountry = ctx.text ?? null;
    }
    if (!derivedPostalCode && matchedFeature?.properties?.postcode) {
      derivedPostalCode = matchedFeature.properties.postcode;
    }
    if (!derivedPostalCode) {
      const cpMatch = (matchedFeature?.place_name ?? "").match(/\b(\d{5})\b/);
      if (cpMatch) derivedPostalCode = cpMatch[1];
    }

    let derivedTimezone: string | null = null;
    const tzResult = findTimezone(lat, lng);
    if (tzResult.length > 0) derivedTimezone = tzResult[0];

    let provinceId: string | null = null;
    if (derivedPostalCode && derivedPostalCode.length >= 2) {
      provinceId = CP_PROVINCE_MAP[derivedPostalCode.substring(0, 2)] ?? null;
    }
    if (!provinceId && derivedCity) provinceId = inferProvince(derivedCity);
    if (!provinceId) provinceId = inferProvince(city);

    return NextResponse.json({
      matchFound: true,
      lat,
      lng,
      precision,
      displayName: matchedFeature?.place_name ?? matchedFeature?.text ?? `${streetAddress}, ${city}`,
      query: [streetAddress, city, country].filter(Boolean).join(", "),
      derived: {
        postalCode: derivedPostalCode,
        provinceId,
        province: derivedProvince,
        city: derivedCity,
        country: derivedCountry,
        timezone: derivedTimezone,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error de conexión con geocoding", matchFound: false }, { status: 502 });
  }
}
