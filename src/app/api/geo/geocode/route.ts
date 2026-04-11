import { NextRequest, NextResponse } from "next/server";
import { find as findTimezone } from "geo-tz";
import { inferProvince } from "@/lib/province-utils";
import { CP_PROVINCE_MAP } from "@/lib/cp-province-map";

const MAPTILER_API_KEY = process.env.MAPTILER_API_KEY;

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
  const streetAddress = typeof body.streetAddress === "string" ? body.streetAddress.trim() : undefined;
  const city = typeof body.city === "string" ? body.city.trim() : undefined;
  const country = typeof body.country === "string" ? body.country.trim() : undefined;

  const queryParts = [streetAddress, city, country].filter(Boolean);
  if (queryParts.length === 0) {
    return NextResponse.json({ error: "Dirección vacía", matchFound: false }, { status: 400 });
  }

  const query = encodeURIComponent(queryParts.join(", "));
  const url = `https://api.maptiler.com/geocoding/${query}.json?key=${MAPTILER_API_KEY}&limit=1&language=es`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Error del proveedor de geocoding", matchFound: false }, { status: 502 });
    }

    const data = await res.json();
    const features = data.features ?? [];

    if (features.length === 0) {
      return NextResponse.json({ matchFound: false, query: queryParts.join(", ") });
    }

    const feature = features[0];
    const [lng, lat] = feature.center ?? feature.geometry?.coordinates ?? [];

    // Extract structured data from context
    const context = feature.context ?? [];
    let derivedPostalCode: string | null = null;
    let derivedProvince: string | null = null;
    let derivedCity: string | null = null;
    let derivedCountry: string | null = null;

    for (const ctx of context) {
      const ctxId = ctx.id ?? "";
      if (ctxId.startsWith("postcode")) derivedPostalCode = ctx.text;
      if (ctxId.startsWith("region") || ctxId.startsWith("province")) derivedProvince = ctx.text;
      if (ctxId.startsWith("place") || ctxId.startsWith("municipality")) derivedCity = ctx.text;
      if (ctxId.startsWith("country")) derivedCountry = ctx.text;
    }

    // Check feature properties and displayName for postal code
    if (!derivedPostalCode && feature.properties?.postcode) {
      derivedPostalCode = feature.properties.postcode;
    }
    if (!derivedPostalCode) {
      const displayName = feature.place_name ?? "";
      const cpMatch = displayName.match(/\b(\d{5})\b/);
      if (cpMatch) derivedPostalCode = cpMatch[1];
    }

    // Derive timezone from coordinates
    let derivedTimezone: string | null = null;
    if (lat != null && lng != null) {
      const tzResult = findTimezone(lat, lng);
      if (tzResult.length > 0) derivedTimezone = tzResult[0];
    }

    // Resolve province ID from postal code or city
    let provinceId: string | null = null;
    if (derivedPostalCode && derivedPostalCode.length >= 2) {
      provinceId = CP_PROVINCE_MAP[derivedPostalCode.substring(0, 2)] ?? null;
    }
    if (!provinceId && derivedCity) {
      provinceId = inferProvince(derivedCity);
    }
    if (!provinceId && city) {
      provinceId = inferProvince(city);
    }

    return NextResponse.json({
      matchFound: true,
      lat,
      lng,
      displayName: feature.place_name ?? feature.text ?? queryParts.join(", "),
      query: queryParts.join(", "),
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
