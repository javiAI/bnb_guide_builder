import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { buildGuestPresentationLayer } from "@/lib/services/guest-presentation-pipeline";
import { renderSwTemplate } from "@/lib/server/sw-template";
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

  const slug = `e2e/${fixture}`;
  const { searchIndex } = buildGuestPresentationLayer(entry.tree);
  const body = renderSwTemplate({ slug, version: searchIndex.buildVersion });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": `/g/${slug}/`,
    },
  });
}
