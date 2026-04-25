import { NextResponse } from "next/server";
import { getDerived } from "@/lib/services/property-derived.service";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import { handleOwnershipApiError } from "@/lib/auth/route-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  try {
    await loadOwnedProperty(propertyId);
    const payload = await getDerived(propertyId);
    return NextResponse.json({ data: payload });
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
