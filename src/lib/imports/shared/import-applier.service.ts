import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  AUDIT_ACTIONS,
  formatActor,
  writeAudit,
} from "@/lib/services/audit.service";
import {
  ImportPayloadParseError,
  type ImportDiff,
  type ImportWarning,
} from "./types";
import { previewAirbnbImport } from "../airbnb/serialize";
import { previewBookingImport } from "../booking/serialize";
import { computePayloadFingerprint } from "./payload-fingerprint";
import {
  InvalidResolutionError,
  POLICIES_PREFIX,
  SCALAR_PREFIX,
  StaleResolutionError,
  planApply,
  type AppliedMutation,
  type ApplyPlan,
  type ResolutionStrategy,
  type SkippedMutation,
} from "./apply-strategies";

export type ImportPlatform = "airbnb" | "booking";

export interface ApplyImportInput {
  propertyId: string;
  platform: ImportPlatform;
  payload: unknown;
  resolutions: Record<string, ResolutionStrategy>;
  actorUserId: string;
}

export type ApplyImportResult =
  | {
      result: "success";
      payloadFingerprint: string;
      applied: AppliedMutation[];
      skipped: SkippedMutation[];
      warnings: ImportWarning[];
    }
  | { result: "noop"; payloadFingerprint: string }
  | { result: "stale"; diff: ImportDiff; missingFields: string[] }
  | { result: "invalid"; field: string; reason: string; message: string }
  | { result: "failed"; payloadFingerprint: string; error: string };

/**
 * Apply a previously-previewed platform import to a Property.
 *
 * Pipeline:
 *   1. Server recomputes its own diff from `payload` (never trusts client).
 *   2. `planApply` reconciles diff with `resolutions` (throws Stale / Invalid).
 *   3. Fingerprint pre-check on AuditLog → noop if same `(payload, resolutions)`
 *      already succeeded (failed rows do NOT block re-apply).
 *   4. `prisma.$transaction` with `SELECT … FOR UPDATE` on the Property:
 *      - scalars via `tx.property.update`
 *      - policies via read+merge+write of `policiesJson`
 *      - amenityInstance shells via createMany / deleteMany
 *   5. Audit row written OUTSIDE the tx — success or failed both audited;
 *      noop is logged but not audited (idempotency contract).
 *
 * Concurrent edit defense: two writers racing on the same Property serialize
 * on the row lock. Without it, JSON merge on policiesJson would lose updates
 * under default READ_COMMITTED isolation.
 */
export async function applyImportDiff(
  input: ApplyImportInput,
): Promise<ApplyImportResult> {
  // Fingerprint and the idempotency lookup don't depend on the diff —
  // start the lookup concurrently with the preview to drop one round-trip
  // from the serial chain.
  const fingerprint = computePayloadFingerprint({
    platform: input.platform,
    payload: input.payload,
    resolutions: input.resolutions,
  });

  const previewP =
    input.platform === "airbnb"
      ? previewAirbnbImport(input.propertyId, input.payload)
      : previewBookingImport(input.propertyId, input.payload);

  const existingP = prisma.auditLog.findFirst({
    where: {
      propertyId: input.propertyId,
      action: AUDIT_ACTIONS.importApply,
      AND: [
        { diffJson: { path: ["payloadFingerprint"], equals: fingerprint } },
        { NOT: { diffJson: { path: ["failed"], equals: true } } },
      ],
    },
    select: { id: true },
  });
  // If the preview throws or planApply rejects first, the lookup is
  // orphaned — silence the unhandled-rejection warning. The real await
  // below still throws if the lookup itself failed.
  existingP.catch(() => undefined);

  const preview = await previewP;
  const serverDiff = preview.diff;
  const serverWarnings = preview.warnings;

  let plan: ApplyPlan;
  try {
    plan = planApply(serverDiff, input.resolutions);
  } catch (err) {
    if (err instanceof StaleResolutionError) {
      return {
        result: "stale",
        diff: serverDiff,
        missingFields: err.missingFields,
      };
    }
    if (err instanceof InvalidResolutionError) {
      return {
        result: "invalid",
        field: err.field,
        reason: err.reasonCode,
        message: err.message,
      };
    }
    throw err;
  }

  const existing = await existingP;
  if (existing) {
    console.info("[import.apply] noop", {
      propertyId: input.propertyId,
      fingerprint,
    });
    return { result: "noop", payloadFingerprint: fingerprint };
  }

  const actor = formatActor({ type: "user", userId: input.actorUserId });
  const allWarnings: ImportWarning[] = [...serverWarnings, ...plan.warnings];

  try {
    await prisma.$transaction(async (tx) => {
      // Lock the Property row for the duration of the tx. Without this,
      // two concurrent applies could merge stale `policiesJson` snapshots.
      await tx.$executeRaw`SELECT id FROM properties WHERE id = ${input.propertyId} FOR UPDATE`;

      const scalarPatch = collectScalarPatch(plan.applied);
      const policyApplied = plan.applied.filter(
        (m) => m.category === "policies",
      );

      let policiesPatch: Record<string, unknown> | undefined;
      if (policyApplied.length > 0) {
        const property = await tx.property.findUnique({
          where: { id: input.propertyId },
          select: { policiesJson: true },
        });
        const current =
          property?.policiesJson &&
          typeof property.policiesJson === "object" &&
          !Array.isArray(property.policiesJson)
            ? structuredClone(property.policiesJson as Record<string, unknown>)
            : {};
        for (const m of policyApplied) {
          const path = m.field.slice(POLICIES_PREFIX.length).split(".");
          setDeep(current, path, m.value);
        }
        policiesPatch = current;
      }

      if (
        Object.keys(scalarPatch).length > 0 ||
        policiesPatch !== undefined
      ) {
        await tx.property.update({
          where: { id: input.propertyId },
          data: {
            ...scalarPatch,
            ...(policiesPatch !== undefined
              ? { policiesJson: policiesPatch as Prisma.InputJsonValue }
              : {}),
          },
        });
      }

      const adds = plan.applied
        .filter((m) => m.category === "amenities.add")
        .map((m) => String(m.value));
      if (adds.length > 0) {
        await tx.propertyAmenityInstance.createMany({
          data: adds.map((amenityKey) => ({
            propertyId: input.propertyId,
            amenityKey,
          })),
          skipDuplicates: true,
        });
      }

      const removes = plan.applied
        .filter((m) => m.category === "amenities.remove")
        .map((m) => String(m.value));
      if (removes.length > 0) {
        await tx.propertyAmenityInstance.deleteMany({
          where: {
            propertyId: input.propertyId,
            amenityKey: { in: removes },
          },
        });
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await writeAudit({
      propertyId: input.propertyId,
      actor,
      entityType: "Property",
      entityId: input.propertyId,
      action: AUDIT_ACTIONS.importApply,
      diff: {
        platform: input.platform,
        payloadFingerprint: fingerprint,
        failed: true,
        error: errorMsg,
      },
    });
    return {
      result: "failed",
      payloadFingerprint: fingerprint,
      error: errorMsg,
    };
  }

  await writeAudit({
    propertyId: input.propertyId,
    actor,
    entityType: "Property",
    entityId: input.propertyId,
    action: AUDIT_ACTIONS.importApply,
    diff: {
      platform: input.platform,
      payloadFingerprint: fingerprint,
      applied: plan.applied,
      skipped: plan.skipped,
      warnings: allWarnings,
    },
  });

  return {
    result: "success",
    payloadFingerprint: fingerprint,
    applied: plan.applied,
    skipped: plan.skipped,
    warnings: allWarnings,
  };
}

function collectScalarPatch(
  applied: AppliedMutation[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const m of applied) {
    if (m.category !== "scalar") continue;
    patch[m.field.slice(SCALAR_PREFIX.length)] = m.value;
  }
  return patch;
}

function setDeep(
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let cursor = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = cursor[key];
    if (next && typeof next === "object" && !Array.isArray(next)) {
      cursor = next as Record<string, unknown>;
    } else {
      const fresh: Record<string, unknown> = {};
      cursor[key] = fresh;
      cursor = fresh;
    }
  }
  cursor[path[path.length - 1]] = value;
}

export { ImportPayloadParseError };
