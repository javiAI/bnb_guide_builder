/**
 *   GET /g/e2e/:fixture/manifest.webmanifest
 *
 * Parallel of `/g/[slug]/manifest.webmanifest` for the Playwright harness.
 * Same `buildGuidePwaManifest` builder, but resolves data from the
 * in-memory fixture (no Prisma). Gated by `process.env.E2E === "1"`.
 */

import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { buildGuidePwaManifest } from "@/lib/server/guide-pwa-manifest";
import { getE2EFixture } from "@/test/fixtures/e2e";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  fixture: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<NextResponse> {
  if (process.env.E2E !== "1") notFound();
  const { fixture } = await params;
  const entry = getE2EFixture(fixture);
  if (!entry) return new NextResponse(null, { status: 404 });

  const manifest = buildGuidePwaManifest({
    slug: `e2e/${fixture}`,
    propertyNickname: entry.propertyTitle,
    brandPaletteKey: null,
  });

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
