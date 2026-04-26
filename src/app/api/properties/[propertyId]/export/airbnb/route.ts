import { NextResponse } from "next/server";
import {
  serializeForAirbnb,
  PropertyNotFoundError as AirbnbPropertyNotFoundError,
} from "@/lib/exports/airbnb";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const GET = withOperatorGuards<{ propertyId: string }>(
  async (_request, { params }) => {
    try {
      const result = await serializeForAirbnb(params.propertyId);
      return NextResponse.json(result, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      if (err instanceof AirbnbPropertyNotFoundError) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: err.message } },
          { status: 404 },
        );
      }
      console.error("Airbnb export failed", { propertyId: params.propertyId, error: err });
      return NextResponse.json(
        { error: { code: "EXPORT_ERROR", message: "Airbnb export failed" } },
        { status: 500 },
      );
    }
  },
  { rateLimit: "expensive" },
);
