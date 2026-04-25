import { NextRequest, NextResponse } from "next/server";
import { previewBookingImport } from "@/lib/imports/booking";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import { handleOwnershipApiError } from "@/lib/auth/route-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    await loadOwnedProperty(propertyId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const result = await previewBookingImport(propertyId, body);
    return NextResponse.json({ data: result });
  } catch (err) {
    if (
      err instanceof Error &&
      ["AuthRequiredError", "PropertyNotFoundError", "PropertyForbiddenError"].includes(
        err.name,
      )
    ) {
      return handleOwnershipApiError(err);
    }
    throw err;
  }
}
