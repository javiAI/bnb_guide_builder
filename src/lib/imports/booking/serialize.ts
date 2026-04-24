import { bookingListingInputSchema } from "@/lib/schemas/booking-listing-input";
import { loadPropertyContext } from "@/lib/exports/shared/load-property";
import { bookingToCanonical } from "./parser";
import { computeImportDiff } from "../shared/diff-engine";
import {
  ImportPayloadParseError,
  type ImportDiff,
  type ImportPreviewResult,
  type ImportWarning,
} from "../shared/types";

/**
 * Orchestrator for the Booking import preview pipeline.
 *
 *   rawJson → Zod parse → bookingToCanonical → loadPropertyContext → computeImportDiff
 *
 * Preview-only: NEVER calls prisma.*.{create,update,delete,upsert}. The
 * reconciler output is a diagnostic shape the UI renders as a diff table;
 * apply is out of scope (14E).
 */
export async function previewBookingImport(
  propertyId: string,
  rawPayload: unknown,
): Promise<ImportPreviewResult> {
  const parsed = bookingListingInputSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new ImportPayloadParseError(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    );
  }

  // Parse incoming payload synchronously (pure function, no IO), then fetch DB in parallel.
  const incomingResult = bookingToCanonical(parsed.data);
  const current = await loadPropertyContext(propertyId);

  const { context: incoming, warnings: parserWarnings } = incomingResult;

  const { diff, warnings: diffWarnings } = computeImportDiff(current, incoming, {
    payloadShape: "booking-v1",
  });

  const warnings: ImportWarning[] = [...parserWarnings, ...diffWarnings];

  return { diff, warnings };
}

export type { ImportDiff, ImportPreviewResult };
