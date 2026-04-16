import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import { renderMarkdown } from "@/lib/renderers/guide-markdown";
import { renderHtml } from "@/lib/renderers/guide-html";
import { renderPdf } from "@/lib/renderers/guide-pdf";

const querySchema = z.object({
  audience: z.enum(["guest", "ai", "internal"]).default("guest"),
  format: z.enum(["md", "html", "json", "pdf"]).default("json"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Property not found" } },
      { status: 404 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    audience: searchParams.get("audience") ?? undefined,
    format: searchParams.get("format") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query params",
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      { status: 400 },
    );
  }
  const { audience, format } = parsed.data;

  try {
    const tree = await composeGuide(propertyId, audience);

    switch (format) {
      case "json":
        return NextResponse.json(tree);
      case "md":
        return new NextResponse(renderMarkdown(tree), {
          status: 200,
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      case "html":
        return new NextResponse(renderHtml(tree), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      case "pdf": {
        const buffer = await renderPdf(tree);
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="guide-${propertyId.replace(/[^a-zA-Z0-9._-]/g, "_")}-${audience}.pdf"`,
          },
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "RENDER_ERROR", message } },
      { status: 500 },
    );
  }
}
