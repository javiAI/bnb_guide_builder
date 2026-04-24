import { NextRequest, NextResponse } from "next/server";
import {
  previewAirbnbImport,
  ImportPayloadParseError,
  PropertyNotFoundError,
} from "@/lib/imports/airbnb";

// Access control: status quo of the repo — knowledge of `propertyId` is the
// only gate. No session / workspace-ownership check exists on any route under
// /api/properties/[propertyId]/... today. The transversal fix is Fase 16 of
// docs/MASTER_PLAN_V2.md (see docs/SECURITY_AND_AUDIT.md §0 and
// docs/FEATURES/PLATFORM_INTEGRATIONS.md §9). Until 16B applies guards
// everywhere, this endpoint must not be described as "secured" or "protected".
//
// Preview-only (14D): this route never mutates DB. It loads the current
// Property, parses an incoming Airbnb payload, reconciles, and returns the
// resulting diff + warnings. No apply endpoint exists yet.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body is not valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await previewAirbnbImport(propertyId, rawPayload);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ImportPayloadParseError) {
      return NextResponse.json(
        {
          error: {
            code: "PAYLOAD_PARSE_ERROR",
            message: err.message,
            issues: err.issues,
          },
        },
        { status: 400 },
      );
    }
    if (err instanceof PropertyNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 },
      );
    }
    console.error("Airbnb import preview failed", { propertyId, error: err });
    return NextResponse.json(
      {
        error: {
          code: "IMPORT_PREVIEW_ERROR",
          message: "Airbnb import preview failed",
        },
      },
      { status: 500 },
    );
  }
}
