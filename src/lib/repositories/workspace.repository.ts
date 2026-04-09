import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: workspace context and membership.
 */
export const workspaceRepository = {
  findById(id: string) {
    return prisma.workspace.findUnique({ where: { id } });
  },

  create(data: Prisma.WorkspaceCreateInput) {
    return prisma.workspace.create({ data });
  },

  findMemberships(workspaceId: string) {
    return prisma.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: true },
    });
  },
};
