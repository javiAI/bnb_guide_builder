import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guideSemanticSearch } from "@/lib/services/guide-search.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(2).max(200),
});

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { slug } = await params;
  const parsed = querySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await guideSemanticSearch({ slug, query: parsed.data.q });
    if (result.kind === "not-found") {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.kind === "rate-limited") {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: result.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(result.retryAfterSeconds),
          },
        },
      );
    }
    return NextResponse.json(result.data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[guide-search] slug=${slug} error:`, err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
