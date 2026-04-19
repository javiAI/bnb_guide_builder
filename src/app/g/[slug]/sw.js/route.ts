import { createHash } from "crypto";
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
    select: { treeJson: true },
  });

  if (!published) {
    // Property exists but has no published version: still serve a valid SW so
    // browsers that previously installed the SW (before unpublish) can update
    // cleanly rather than hitting a 404 update check. New installations are
    // prevented by the layout guard. Missing slug → 404.
    const property = await prisma.property.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!property) return new NextResponse(null, { status: 404 });
  }

  const version = published?.treeJson
    ? buildGuestPresentationLayer(published.treeJson as unknown as GuideTree)
        .searchIndex.buildVersion
    : createHash("sha1").update(slug).digest("hex").slice(0, 12);

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
