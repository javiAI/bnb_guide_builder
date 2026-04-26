import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveLocalPoiProvider,
  PoiProviderConfigError,
  PoiProviderUnavailableError,
} from "@/lib/services/places";
import {
  checkPlacesRateLimit,
  enforcePlacesBucketCap,
} from "@/lib/services/places/rate-limit";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// Per-property places limiter (heritage de 13D — protege contra bursts
// cross-property anónimos) coexiste con el guard `expensive` por userId del
// wrapper: este aplica primero, el del wrapper aplica antes que esto.
export const GET = withOperatorGuards<{ propertyId: string }>(
  async (request, { params, guarded }) => {
    const { property } = guarded;
    const { propertyId } = params;

    const parsed = querySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? "",
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      lang: request.nextUrl.searchParams.get("lang") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_query", issues: parsed.error.issues },
        { status: 400, headers: NO_STORE },
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
      console.error(`[places-search] propertyId=${propertyId} error:`, err);
      return NextResponse.json(
        { error: "internal_error" },
        { status: 500, headers: NO_STORE },
      );
    }
  },
  { rateLimit: "expensive" },
);
