import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { askRequestSchema } from "@/lib/schemas/assistant.schema";
import { buildAnswer } from "@/lib/assistant/retrieval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  // Validate property exists
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

  // Parse and validate body
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

  const { question, language, audience, journeyStage, conversationId } =
    parsed.data;

  // Build answer using retrieval pipeline
  const result = await buildAnswer({
    propertyId,
    question,
    language,
    audience,
    journeyStage,
  });

  // Persist conversation and messages
  let convId = conversationId;

  if (!convId) {
    const conv = await prisma.assistantConversation.create({
      data: {
        property: { connect: { id: propertyId } },
        actorType: "guest",
        audience,
        language,
      },
    });
    convId = conv.id;
  }

  // Save user question
  await prisma.assistantMessage.create({
    data: {
      conversation: { connect: { id: convId } },
      role: "user",
      body: question,
    },
  });

  // Save assistant response
  await prisma.assistantMessage.create({
    data: {
      conversation: { connect: { id: convId } },
      role: "assistant",
      body: result.answer,
      citationsJson: result.citations,
      confidenceScore: result.confidenceScore,
      escalated: result.escalated,
    },
  });

  return NextResponse.json({
    data: {
      answer: result.answer,
      citations: result.citations,
      confidenceScore: result.confidenceScore,
      escalated: result.escalated,
      escalationReason: result.escalationReason,
      conversationId: convId,
    },
  });
}
