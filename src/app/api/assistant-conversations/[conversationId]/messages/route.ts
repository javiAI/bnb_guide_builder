import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  const conversation = await prisma.assistantConversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conversation not found" } },
      { status: 404 },
    );
  }

  const messages = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    data: messages.map((m) => ({
      id: m.id,
      role: m.role,
      body: m.body,
      citationsJson: m.citationsJson,
      confidenceScore: m.confidenceScore,
      escalated: m.escalated,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
