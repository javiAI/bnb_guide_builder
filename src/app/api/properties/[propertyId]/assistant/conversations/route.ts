import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createConversationSchema } from "@/lib/schemas/assistant.schema";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const GET = withOperatorGuards<{ propertyId: string }>(
  async (_request, { params }) => {
    const conversations = await prisma.assistantConversation.findMany({
      where: { propertyId: params.propertyId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
        // First user message = a human-readable preview for the history list.
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { body: true },
        },
      },
    });

    return NextResponse.json({
      data: conversations.map((c) => ({
        id: c.id,
        actorType: c.actorType,
        audience: c.audience,
        language: c.language,
        messageCount: c._count.messages,
        // Display-only snippet for the history list — bounded here so the
        // contract isn't "send the whole message body and let CSS clamp it".
        preview: c.messages[0]?.body.slice(0, 160) ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  },
  { rateLimit: "read" },
);

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

    const parsed = createConversationSchema.safeParse(body);
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

    const conversation = await prisma.assistantConversation.create({
      data: {
        property: { connect: { id: params.propertyId } },
        actorType: parsed.data.actorType,
        audience: parsed.data.audience,
        language: parsed.data.language,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: conversation.id,
          actorType: conversation.actorType,
          audience: conversation.audience,
          language: conversation.language,
          createdAt: conversation.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  },
  { rateLimit: "mutate" },
);
