import { NextRequest, NextResponse } from "next/server";
import { serializeForBooking } from "@/lib/exports/booking";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import { handleOwnershipApiError } from "@/lib/auth/route-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    await loadOwnedProperty(propertyId);
    const result = await serializeForBooking(propertyId);
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (
      err instanceof Error &&
      ["AuthRequiredError", "PropertyNotFoundError", "PropertyForbiddenError"].includes(
        err.name,
      )
    ) {
      return handleOwnershipApiError(err);
    }
    console.error("Booking export failed", { propertyId, error: err });
    return NextResponse.json(
      { error: { code: "EXPORT_ERROR", message: "Booking export failed" } },
      { status: 500 },
    );
  }
}
