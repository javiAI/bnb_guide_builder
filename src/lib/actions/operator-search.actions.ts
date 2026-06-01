"use server";

import { requireOperator } from "@/lib/auth/require-operator";
import { prisma } from "@/lib/db";
import {
  getOperatorSearchIndex,
  type OperatorSearchEntry,
} from "@/lib/services/operator-search.service";

/**
 * Lazy-loaded operator command-palette index (Liora 16F.5). Read-only; gated by
 * `requireOperator()` + an ownership scope (the property must belong to the
 * caller's workspace). No audit — it's a read.
 */
export async function getOperatorSearchAction(
  propertyId: string,
): Promise<OperatorSearchEntry[]> {
  const operator = await requireOperator();
  const owned = await prisma.property.findFirst({
    where: { id: propertyId, workspaceId: operator.workspaceId },
    select: { id: true },
  });
  if (!owned) return [];
  return getOperatorSearchIndex(propertyId);
}
