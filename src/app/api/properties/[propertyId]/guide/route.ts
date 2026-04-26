import { NextResponse } from "next/server";
import { z } from "zod";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import { renderMarkdown } from "@/lib/renderers/guide-markdown";
import { renderHtml } from "@/lib/renderers/guide-html";
import { renderPdf } from "@/lib/renderers/guide-pdf";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

const querySchema = z.object({
  audience: z.enum(["guest", "ai", "internal"]).default("guest"),
  format: z.enum(["md", "html", "json", "pdf"]).default("json"),
});

export const GET = withOperatorGuards<{ propertyId: string }>(
  async (request, { params, guarded }) => {
    const { property } = guarded;
    const { propertyId } = params;

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
      const tree = await composeGuide(propertyId, audience, property.publicSlug);

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
      console.error("Failed to render property guide", { propertyId, error: err });
      return NextResponse.json(
        { error: { code: "RENDER_ERROR", message: "Failed to render guide" } },
        { status: 500 },
      );
    }
  },
  { rateLimit: "read" },
);
