import { NextRequest, NextResponse } from "next/server";
import { find as findTimezone } from "geo-tz";
import { inferProvince } from "@/lib/province-utils";
import { CP_PROVINCE_MAP } from "@/lib/cp-province-map";

const MAPTILER_API_KEY = process.env.MAPTILER_API_KEY;

export async function POST(request: NextRequest) {
  if (!MAPTILER_API_KEY) {
    return NextResponse.json({ error: "Geocoding no configurado" }, { status: 503 });
  }

  const { lat, lng } = await request.json();
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "Coordenadas requeridas" }, { status: 400 });
  }

  const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_API_KEY}&language=es`;

  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "Error del proveedor" }, { status: 502 });

    const data = await res.json();
    const features = data.features ?? [];
    if (features.length === 0) return NextResponse.json({ matchFound: false });

    const feature = features[0];
    const context = feature.context ?? [];

    let streetAddress: string | null = null;
    let city: string | null = null;
    let country: string | null = null;
    let postalCode: string | null = null;

    // Feature text is usually the street name + number
    if (feature.place_type?.includes("address") || feature.place_type?.includes("poi")) {
      streetAddress = feature.text ? `${feature.text}${feature.address ? ` ${feature.address}` : ""}` : null;
    }

    for (const ctx of context) {
      const ctxId = ctx.id ?? "";
      if (ctxId.startsWith("place") || ctxId.startsWith("municipality")) city = ctx.text;
      if (ctxId.startsWith("postcode")) postalCode = ctx.text;
      if (ctxId.startsWith("country")) country = ctx.text;
    }

    if (!postalCode) {
      const displayName = feature.place_name ?? "";
      const cpMatch = displayName.match(/\b(\d{5})\b/);
      if (cpMatch) postalCode = cpMatch[1];
    }

    let provinceId: string | null = null;
    if (postalCode && postalCode.length >= 2) {
      provinceId = CP_PROVINCE_MAP[postalCode.substring(0, 2)] ?? null;
    }
    if (!provinceId && city) provinceId = inferProvince(city);

    const tzResult = findTimezone(lat, lng);
    const timezone = tzResult.length > 0 ? tzResult[0] : null;

    return NextResponse.json({
      matchFound: true,
      streetAddress,
      city,
      country,
      postalCode,
      provinceId,
      timezone,
    });
  } catch {
    return NextResponse.json({ error: "Error de conexión" }, { status: 502 });
  }
}
