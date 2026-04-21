import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  resolveLocalPoiProvider,
  PoiProviderConfigError,
  PoiProviderUnavailableError,
} from "@/lib/services/places";
import {
  checkPlacesRateLimit,
  enforcePlacesBucketCap,
} from "@/lib/services/places/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Host-facing typeahead: `GET /api/properties/:propertyId/places-search`.
// Anchor coordinates are always derived server-side from `Property.latitude`
// and `Property.longitude` — never trusted from the query string. This way a
// misconfigured client can't bias results against a property it owns.

const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(15).optional()),
  lang: z.enum(["es", "en"]).optional().default("es"),
});

const NO_STORE = { "Cache-Control": "no-store" } as const;

interface RouteContext {
  params: Promise<{ propertyId: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { propertyId } = await params;

  const parsed = querySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    lang: req.nextUrl.searchParams.get("lang") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400, headers: NO_STORE },
    );
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, latitude: true, longitude: true },
  });
  if (!property) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE },
    );
  }
  if (property.latitude === null || property.longitude === null) {
    return NextResponse.json(
      { error: "property_missing_coordinates" },
      { status: 409, headers: NO_STORE },
    );
  }

  const now = Date.now();
  const gate = checkPlacesRateLimit(propertyId, now);
  enforcePlacesBucketCap(now);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: gate.retryAfterSeconds },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(gate.retryAfterSeconds) },
      },
    );
  }

  let provider;
  try {
    provider = resolveLocalPoiProvider();
  } catch (err) {
    if (err instanceof PoiProviderConfigError) {
      return NextResponse.json(
        { error: "provider_not_configured" },
        { status: 503, headers: NO_STORE },
      );
    }
    throw err;
  }

  try {
    const suggestions = await provider.search({
      query: parsed.data.q,
      anchor: {
        latitude: property.latitude,
        longitude: property.longitude,
      },
      language: parsed.data.lang,
      limit: parsed.data.limit,
    });
    return NextResponse.json(
      { suggestions, provider: provider.name },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof PoiProviderUnavailableError) {
      return NextResponse.json(
        { error: "provider_unavailable" },
        { status: 502, headers: NO_STORE },
      );
    }
    console.error(
      `[places-search] propertyId=${propertyId} error:`,
      err,
    );
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
