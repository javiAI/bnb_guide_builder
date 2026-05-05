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
        // The payload embeds the current MapTiler API key in `styleUrl`. We
        // can cache to avoid a round-trip per map mount, but `immutable` is
        // unsafe — when the key rotates (env update / deploy), browsers must
        // be able to refetch within a bounded window instead of holding a
        // dead style URL until the cache expires. SWR keeps the UX fast on
        // navigation while letting the cache pick up a new key in the
        // background.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
