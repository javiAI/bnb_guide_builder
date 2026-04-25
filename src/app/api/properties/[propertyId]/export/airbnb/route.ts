import { NextRequest, NextResponse } from "next/server";
import {
  serializeForAirbnb,
  PropertyNotFoundError as AirbnbPropertyNotFoundError,
} from "@/lib/exports/airbnb";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import { handleOwnershipApiError } from "@/lib/auth/route-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    await loadOwnedProperty(propertyId);

    const result = await serializeForAirbnb(propertyId);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      ["AuthRequiredError", "PropertyNotFoundError", "PropertyForbiddenError"].includes(
        err.name,
      )
    ) {
      return handleOwnershipApiError(err);
    }

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
