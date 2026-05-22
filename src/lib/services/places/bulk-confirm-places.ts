import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperatorMutate } from "@/lib/services/places/discovery-guards";
import {
  AUDIT_ACTIONS,
  formatActor,
  writeAudit,
} from "@/lib/services/audit.service";
import { isPrismaUniqueViolation } from "@/lib/utils";
import type { ProviderMetadata } from "@/lib/services/places";
import type { ActionResult } from "@/lib/types/action-result";

/** Minimum shape every bulk-confirm item must carry. Callers extend it with
 * domain-specific fields (parking adds `feeType`; arrival adds `mode`) which
 * flow through `categoryKeyOf` and `transformMetadata` callbacks. */
export interface BulkConfirmBaseItem {
  propertyId: string;
  provider: string;
  providerPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  website: string | null;
  distanceMeters: number;
  providerMetadata: ProviderMetadata;
}

export interface BulkConfirmResult {
  created: string[];
  /** providerPlaceIds that were silently skipped because the row already
   * existed (P2002). Lets the UI prune them from the suggestions list. */
  skippedProviderPlaceIds: string[];
}

/** Tag persisted in the audit log `diff.source` field — distinguishes
 * parking bulk-confirm from arrival bulk-confirm. Add a new union member
 * before passing it from a new action; the audit `diff.source` field is the
 * grep handle in the audit table. */
export type BulkConfirmAuditSource =
  | "provider-suggestion-bulk"
  | "arrival-suggestion-bulk";

interface BulkConfirmOptions<I extends BulkConfirmBaseItem> {
  items: ReadonlyArray<I>;
  /** Resolve the `categoryKey` for the row Prisma will insert. Parking returns
   * the parking constant; arrival derives it from the per-item mode. */
  categoryKeyOf: (item: I) => string;
  /** Optional post-process of `providerMetadata` before insert. Parking uses
   * it to merge an operator-chosen `feeType` into the metadata blob. */
  transformMetadata?: (item: I) => ProviderMetadata;
  auditSource: BulkConfirmAuditSource;
}

/** Bulk-confirm provider suggestions into `localPlace` rows. Composes
 * `requireOperatorMutate` (auth + `mutate` actor bucket), scopes the
 * workspace check by property, fans out the creates in parallel via
 * `Promise.allSettled`,
 * audits successes individually, and swallows P2002 (duplicate) silently —
 * a sibling unique violation isn't a user error, it's idempotency. Any
 * non-P2002 rejection is rethrown after the audits flush, matching the
 * pre-extraction semantics where a partial success still emits audits for
 * the rows that landed. */
export async function bulkConfirmPlaces<I extends BulkConfirmBaseItem>(
  opts: BulkConfirmOptions<I>,
): Promise<ActionResult<BulkConfirmResult>> {
  const { items, categoryKeyOf, transformMetadata, auditSource } = opts;

  const propertyIds = new Set(items.map((i) => i.propertyId));
  if (propertyIds.size !== 1) {
    return {
      success: false,
      error: "Todos los items deben pertenecer a la misma propiedad",
    };
  }
  const propertyId = items[0].propertyId;

  const auth = await requireOperatorMutate();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  const property = await prisma.property.findUnique({
    where: { id: propertyId, workspaceId: operator.workspaceId },
    select: { id: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  // Each item is independent (its own row, its own providerPlaceId unique
  // key) so we fan out in parallel. Audit emission is the only ordering
  // concern — handled by writing audits for fulfilled rows even when a
  // sibling rejected with a non-P2002 error.
  const settled = await Promise.allSettled(
    items.map(async (item) => {
      const categoryKey = categoryKeyOf(item);
      const providerMetadata = transformMetadata
        ? transformMetadata(item)
        : item.providerMetadata;
      const row = await prisma.localPlace.create({
        data: {
          propertyId: item.propertyId,
          categoryKey,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          address: item.address,
          website: item.website,
          distanceMeters: item.distanceMeters,
          provider: item.provider,
          providerPlaceId: item.providerPlaceId,
          providerMetadata,
          visibility: "guest",
        },
        select: { id: true },
      });
      return { id: row.id, categoryKey };
    }),
  );

  const created: string[] = [];
  const skipped: string[] = [];
  const auditPromises: Promise<void>[] = [];
  let unknownError: unknown = null;
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const item = items[i];
    if (result.status === "fulfilled") {
      created.push(result.value.id);
      auditPromises.push(
        writeAudit({
          propertyId,
          actor: formatActor({ type: "user", userId: operator.userId }),
          entityType: "LocalPlace",
          entityId: result.value.id,
          action: AUDIT_ACTIONS.create,
          diff: {
            categoryKey: result.value.categoryKey,
            name: item.name,
            provider: item.provider,
            providerPlaceId: item.providerPlaceId,
            visibility: "guest",
            source: auditSource,
          },
        }),
      );
    } else if (isPrismaUniqueViolation(result.reason)) {
      skipped.push(item.providerPlaceId);
    } else {
      unknownError = unknownError ?? result.reason;
    }
  }
  await Promise.all(auditPromises);
  if (unknownError) throw unknownError;

  if (created.length > 0) {
    revalidatePath(`/properties/${propertyId}/access`);
  }
  return {
    success: true,
    data: { created, skippedProviderPlaceIds: skipped },
  };
}
