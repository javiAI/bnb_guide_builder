import { NextRequest, NextResponse } from "next/server";
import {
  previewBookingImport,
  ImportPayloadParseError,
  PropertyNotFoundError,
} from "@/lib/imports/booking";

// ⚠️ Access control: Status quo (Rama 14E)
// This endpoint gates on propertyId knowledge only (404 if not found).
// No auth, workspace membership, or user identity checks. See Fase 16 in
// docs/MASTER_PLAN_V2.md for hardening plan.

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
    const result = await previewBookingImport(propertyId, rawPayload);
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
    console.error("Booking import preview failed", { propertyId, error: err });
    return NextResponse.json(
      {
        error: {
          code: "IMPORT_PREVIEW_ERROR",
          message: "Booking import preview failed",
        },
      },
      { status: 500 },
    );
  }
}
