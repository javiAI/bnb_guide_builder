import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createIncidentFromGuest,
  GuestIncidentPayloadSchema,
} from "@/lib/services/incident-from-guest.service";
import {
  signPublicCapability,
  readPublicCapabilityFromCookie,
  setPublicCapabilityCookie,
} from "@/lib/auth/public-capability";
import { MAX_INCIDENT_IDS_PER_COOKIE } from "@/lib/auth/public-capability-registry";
import { checkSlidingWindowLimit } from "@/lib/services/sliding-window-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;
const RATE_BUCKETS_SOFT_CAP = 512;

const rateBuckets = new Map<string, number[]>();

/** Test-only helper: clear the rate-limit window. */
export function __resetIncidentRateLimitForTests(): void {
  rateBuckets.clear();
}

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/** Extracts a best-effort client IP from the platform headers. Falls back to
 *  an "unknown" bucket so rate-limiting still engages when the proxy strips
 *  headers — a single shared bucket caps abusive traffic to the same ceiling. */
function clientIpFromRequest(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { slug } = await params;

  // Resolve the property by slug first — a 410 on an unpublished/removed slug
  // is more useful than rate-limiting it (bots hitting dead slugs shouldn't
  // eat the quota of the legitimate live slug that replaced them).
  const property = await prisma.property.findUnique({
    where: { publicSlug: slug },
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json(
      { error: "gone" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }
  const published = await prisma.guideVersion.findFirst({
    where: { propertyId: property.id, status: "published" },
    select: { id: true },
  });
  if (!published) {
    return NextResponse.json(
      { error: "gone" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ip = clientIpFromRequest(req);
  const rateKey = `${slug}|${ip}`;
  const gate = checkSlidingWindowLimit(rateBuckets, rateKey, Date.now(), {
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX,
    bucketsSoftCap: RATE_BUCKETS_SOFT_CAP,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: gate.retryAfterSeconds },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(gate.retryAfterSeconds),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = GuestIncidentPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { incidentId } = await createIncidentFromGuest({
      propertyId: property.id,
      payload: parsed.data,
    });

    // Re-verify the existing capability cookie (drop-silent) and merge the
    // new incident id into its `ids` payload. A tampered/expired cookie is
    // treated as missing — the guest just starts fresh with the new id only.
    const existing = readPublicCapabilityFromCookie({
      cookies: req.cookies,
      capability: "incident_read",
      slug,
    });
    const allIds = existing
      ? [...existing.payload.ids, incidentId]
      : [incidentId];
    const nextIds = Array.from(new Set(allIds)).slice(
      -MAX_INCIDENT_IDS_PER_COOKIE,
    );
    const signedValue = signPublicCapability({
      capability: "incident_read",
      slug,
      payload: { ids: nextIds },
    });

    const response = NextResponse.json(
      { incidentId, trackUrl: `/g/${slug}/incidents/${incidentId}` },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
    setPublicCapabilityCookie({
      response,
      capability: "incident_read",
      slug,
      signedValue,
    });
    return response;
  } catch (err) {
    console.error(`[guest-incident-create] slug=${slug} error:`, err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
