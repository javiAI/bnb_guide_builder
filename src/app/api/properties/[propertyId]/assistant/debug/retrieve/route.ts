import { NextRequest, NextResponse } from "next/server";
import { debugRetrieveRequestSchema } from "@/lib/schemas/assistant.schema";
import { retrieve } from "@/lib/services/assistant/pipeline";
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

    const parsed = debugRetrieveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            details: { fieldErrors: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 400 },
      );
    }

    const { question, language, audience } = parsed.data;
    const results = await retrieve({ propertyId, question, language, audience });

    return NextResponse.json({ data: results });
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
