import { NextRequest, NextResponse } from "next/server";
import {
  serializeForAirbnb,
  PropertyNotFoundError as AirbnbPropertyNotFoundError,
} from "@/lib/exports/airbnb";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import {
  AuthRequiredError,
  PropertyNotFoundError,
  PropertyForbiddenError,
} from "@/lib/auth/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    // Verify ownership first
    await loadOwnedProperty(propertyId);

    // Export the property
    const result = await serializeForAirbnb(propertyId);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // Handle auth/ownership errors
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: err.message } },
        { status: 401 },
      );
    }
    if (err instanceof PropertyNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 },
      );
    }
    if (err instanceof PropertyForbiddenError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: err.message } },
        { status: 403 },
      );
    }

    // Handle export-specific errors
    if (err instanceof AirbnbPropertyNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 },
      );
    }

    console.error("Airbnb export failed", { propertyId, error: err });
    return NextResponse.json(
      { error: { code: "EXPORT_ERROR", message: "Airbnb export failed" } },
      { status: 500 },
    );
  }
}
