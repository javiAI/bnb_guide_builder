import { NextResponse } from "next/server";
import { previewAirbnbImport } from "@/lib/imports/airbnb";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const POST = withOperatorGuards<{ propertyId: string }>(
  async (request, { params }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const result = await previewAirbnbImport(params.propertyId, body);
    return NextResponse.json({ data: result });
  },
  { rateLimit: "mutate" },
);
