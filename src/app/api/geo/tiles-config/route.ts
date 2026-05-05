import { NextResponse } from "next/server";

const MAPTILER_API_KEY = process.env.MAPTILER_API_KEY;

export async function GET() {
  if (!MAPTILER_API_KEY) {
    return NextResponse.json({ error: "Mapa no configurado" }, { status: 503 });
  }

  return NextResponse.json(
    {
      styleUrl: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
    },
    {
      headers: {
        // Stable until the API key rotates (deploy event). Long-lived cache
        // avoids a fresh round-trip per map mount across navigations.
        "Cache-Control": "public, max-age=86400, immutable",
      },
    },
  );
}
