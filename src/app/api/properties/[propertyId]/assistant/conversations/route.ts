import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createConversationSchema } from "@/lib/schemas/assistant.schema";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import { handleOwnershipApiError } from "@/lib/auth/route-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    await loadOwnedProperty(propertyId);

    const conversations = await prisma.assistantConversation.findMany({
      where: { propertyId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({
      data: conversations.map((c) => ({
        id: c.id,
        actorType: c.actorType,
        audience: c.audience,
        language: c.language,
        messageCount: c._count.messages,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    if (
      err instanceof Error &&
      ["AuthRequiredError", "PropertyNotFoundError", "PropertyForbiddenError"].includes(
        err.name,
      )
    ) {
      return handleOwnershipApiError(err);
    }
    throw err;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    await loadOwnedProperty(propertyId);

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
        property: { connect: { id: propertyId } },
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
  } catch (err) {
    if (
      err instanceof Error &&
      ["AuthRequiredError", "PropertyNotFoundError", "PropertyForbiddenError"].includes(
        err.name,
      )
    ) {
      return handleOwnershipApiError(err);
    }
    throw err;
  }
}
