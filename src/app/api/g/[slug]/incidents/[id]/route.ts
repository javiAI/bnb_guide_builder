import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseGuestIncidentCookieValue,
  guestIncidentCookieName,
} from "@/lib/services/guest-incident-cookie";
import {
  GUEST_INCIDENT_READABLE_FIELDS,
  type GuestReadableIncidentField,
} from "@/lib/visibility";
import { findIncidentCategory } from "@/lib/taxonomy-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

/** Projection of an `Incident` row matching the whitelist in
 *  `GUEST_INCIDENT_READABLE_FIELDS`. We construct the object field-by-field
 *  from the whitelist so adding a new column to `Incident` never accidentally
 *  leaks through this route — only explicit additions to the whitelist show
 *  up here. */
function projectGuestVisible(
  incident: Record<GuestReadableIncidentField, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of GUEST_INCIDENT_READABLE_FIELDS) {
    const value = incident[field];
    if (value instanceof Date) {
      out[field] = value.toISOString();
    } else {
      out[field] = value;
    }
  }
  return out;
}

export async function GET(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { slug, id } = await params;

  // Cookie-scoped authorization: the guest can read an incident only if its
  // id appears in the slug-specific signed cookie they received at creation
  // time. No cookie / tampered cookie / wrong slug → 404 (not 401/403 — we
  // don't want to confirm the id exists to an unauthorized caller).
  const cookieRaw = req.cookies.get(guestIncidentCookieName(slug))?.value ?? null;
  const parsedCookie = cookieRaw
    ? parseGuestIncidentCookieValue(cookieRaw, slug)
    : null;
  if (!parsedCookie || !parsedCookie.ids.includes(id)) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const property = await prisma.property.findUnique({
    where: { publicSlug: slug },
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const incident = await prisma.incident.findFirst({
    where: {
      id,
      propertyId: property.id,
      origin: "guest_guide",
    },
    select: {
      id: true,
      status: true,
      categoryKey: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  if (!incident) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const projected = projectGuestVisible(incident);
  // Enrich with taxonomy labels so the page can render without re-loading
  // taxonomy on the client. Category label is derived from the whitelisted
  // `categoryKey` — it's presentation data, not additional Incident state.
  const category = incident.categoryKey
    ? findIncidentCategory(incident.categoryKey)
    : null;
  const enriched = {
    ...projected,
    categoryLabel: category?.guestLabel ?? null,
    categoryIcon: category?.icon ?? null,
  };

  return NextResponse.json(enriched, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
