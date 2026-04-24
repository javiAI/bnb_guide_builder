import { airbnbListingInputSchema } from "@/lib/schemas/airbnb-listing-input";
import { loadPropertyContext } from "@/lib/exports/shared/load-property";
import { airbnbToCanonical } from "./parser";
import { computeImportDiff } from "../shared/diff-engine";
import {
  ImportPayloadParseError,
  type ImportDiff,
  type ImportPreviewResult,
  type ImportWarning,
} from "../shared/types";

/**
 * Orchestrator for the Airbnb import preview pipeline.
 *
 *   rawJson → Zod parse → airbnbToCanonical → loadPropertyContext → computeImportDiff
 *
 * Preview-only: NEVER calls prisma.*.{create,update,delete,upsert}. The
 * reconciler output is a diagnostic shape the UI renders as a diff table;
 * apply is out of scope (14D).
 */
export async function previewAirbnbImport(
  propertyId: string,
  rawPayload: unknown,
): Promise<ImportPreviewResult> {
  const parsed = airbnbListingInputSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new ImportPayloadParseError(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    );
  }

  // Fire DB query and parse incoming payload in parallel (independent operations).
  const [current, incomingResult] = await Promise.all([
    loadPropertyContext(propertyId),
    Promise.resolve(airbnbToCanonical(parsed.data)),
  ]);

  const { context: incoming, warnings: parserWarnings } = incomingResult;

  const { diff, warnings: diffWarnings } = computeImportDiff(current, incoming, {
    payloadShape: "airbnb-v1",
  });

  const warnings: ImportWarning[] = [...parserWarnings, ...diffWarnings];

  return { diff, warnings };
}

export type { ImportDiff, ImportPreviewResult };
