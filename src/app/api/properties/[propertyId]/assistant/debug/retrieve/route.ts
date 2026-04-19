import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { debugRetrieveRequestSchema } from "@/lib/schemas/assistant.schema";
import { retrieve } from "@/lib/services/assistant/pipeline";
import { coerceJourneyStage } from "@/lib/types/knowledge";

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
  const stage = coerceJourneyStage(journeyStage);

  const result = await retrieve({
    propertyId,
    question,
    language,
    audience,
    journeyStage: stage,
  });

  return NextResponse.json({
    data: {
      query: { question, language, audience, journeyStage: stage },
      intent: result.intent,
      retrieval: result.retrieval,
      totalCandidates: result.items.length,
      candidates: result.items.map((it) => ({
        knowledgeItemId: it.id,
        topic: it.topic,
        visibility: it.visibility,
        entityType: it.entityType,
        journeyStage: it.journeyStage,
        bm25Score: it.bm25Score,
        vectorScore: it.vectorScore,
        rrfScore: it.rrfScore,
        rerankScore: it.rerankScore,
      })),
    },
  });
}
