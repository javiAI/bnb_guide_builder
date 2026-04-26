import { NextResponse } from "next/server";
import { askRequestSchema } from "@/lib/schemas/assistant.schema";
import { ask } from "@/lib/services/assistant/pipeline";
import { coerceJourneyStage } from "@/lib/types/knowledge";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const POST = withOperatorGuards<{ propertyId: string }>(
  async (request, { params }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = askRequestSchema.safeParse(body);
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

    const { question, language, audience, journeyStage, conversationId } = parsed.data;
    const stage = coerceJourneyStage(journeyStage);

    const result = await ask({
      propertyId: params.propertyId,
      question,
      language,
      audience,
      journeyStage: stage,
      conversationId: conversationId ?? null,
      actorType: "guest",
    });

    return NextResponse.json({
      data: {
        answer: result.answer,
        citations: result.citations,
        confidenceScore: result.confidenceScore,
        escalated: result.escalated,
        escalationReason: result.escalationReason,
        escalationContact: result.escalationContact,
        conversationId: result.conversationId,
      },
    });
  },
  { rateLimit: "expensive" },
);
