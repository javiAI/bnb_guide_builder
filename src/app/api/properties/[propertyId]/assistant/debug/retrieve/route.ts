import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { debugRetrieveRequestSchema } from "@/lib/schemas/assistant.schema";
import { retrieveCandidates } from "@/lib/assistant/retrieval";

export async function POST(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = debugRetrieveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid payload",
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      { status: 400 },
    );
  }

  const { question, language, audience, journeyStage } = parsed.data;

  const candidates = await retrieveCandidates({
    propertyId,
    question,
    locale: language,
    audience,
    journeyStage,
  });

  return NextResponse.json({
    data: {
      query: { question, language, audience, journeyStage },
      totalCandidates: candidates.length,
      candidates,
    },
  });
}
