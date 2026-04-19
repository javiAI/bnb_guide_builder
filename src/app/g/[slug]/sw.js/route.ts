import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildGuestPresentationLayer } from "@/lib/services/guest-presentation-pipeline";
import type { GuideTree } from "@/lib/types/guide-tree";
import { renderSwTemplate } from "@/lib/server/sw-template";

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

  const published = await prisma.guideVersion.findFirst({
    where: { property: { publicSlug: slug }, status: "published" },
    orderBy: { version: "desc" },
    select: { treeJson: true, property: { select: { id: true } } },
  });

  if (!published) {
    // Distinguish "no such property" from "property exists but unpublished":
    // the unpublished case still ships a SW shell (offline fallback works
    // before first publish), the missing-slug case returns 404.
    const property = await prisma.property.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!property) return new NextResponse(null, { status: 404 });
  }

  const version = published?.treeJson
    ? buildGuestPresentationLayer(published.treeJson as unknown as GuideTree)
        .searchIndex.buildVersion
    : "v0";

  const body = renderSwTemplate({ slug, version });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": `/g/${slug}/`,
    },
  });
}
