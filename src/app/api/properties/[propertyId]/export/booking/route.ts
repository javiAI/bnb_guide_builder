import { NextRequest, NextResponse } from "next/server";
import {
  serializeForBooking,
  PropertyNotFoundError,
} from "@/lib/exports/booking";

// Access control: status quo of the repo — knowledge of `propertyId` is the
// only gate. No session / workspace-ownership check exists on any route under
// /api/properties/[propertyId]/... today. The transversal fix is Fase 16 of
// docs/MASTER_PLAN_V2.md (see docs/SECURITY_AND_AUDIT.md §0 and
// docs/FEATURES/PLATFORM_INTEGRATIONS.md §9). Until 16B applies guards
// everywhere, this endpoint must not be described as "secured" or "protected".
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    const result = await serializeForBooking(propertyId);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof PropertyNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 },
      );
    }
    console.error("Booking export failed", { propertyId, error: err });
    return NextResponse.json(
      { error: { code: "EXPORT_ERROR", message: "Booking export failed" } },
      { status: 500 },
    );
  }
}
