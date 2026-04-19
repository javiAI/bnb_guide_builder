import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildGuidePwaManifest } from "@/lib/server/guide-pwa-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  slug: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<NextResponse> {
  const { slug } = await params;

  const property = await prisma.property.findUnique({
    where: { publicSlug: slug },
    select: { propertyNickname: true, brandPaletteKey: true },
  });
  if (!property) {
    return new NextResponse(null, { status: 404 });
  }

  const manifest = buildGuidePwaManifest({
    slug,
    propertyNickname: property.propertyNickname,
    brandPaletteKey: property.brandPaletteKey,
  });

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
