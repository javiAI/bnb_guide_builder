import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: assistant conversations and messages.
 */
export const assistantRepository = {
  findConversationsByProperty(propertyId: string) {
    return prisma.assistantConversation.findMany({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
    });
  },

  findConversationById(id: string) {
    return prisma.assistantConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  createConversation(data: Prisma.AssistantConversationCreateInput) {
    return prisma.assistantConversation.create({ data });
  },

  addMessage(data: Prisma.AssistantMessageCreateInput) {
    return prisma.assistantMessage.create({ data });
  },
};
