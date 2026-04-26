import { NextResponse } from "next/server";
import { serializeForBooking } from "@/lib/exports/booking";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const GET = withOperatorGuards<{ propertyId: string }>(
  async (_request, { params }) => {
    try {
      const result = await serializeForBooking(params.propertyId);
      return NextResponse.json(result, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      console.error("Booking export failed", { propertyId: params.propertyId, error: err });
      return NextResponse.json(
        { error: { code: "EXPORT_ERROR", message: "Booking export failed" } },
        { status: 500 },
      );
    }
  },
  { rateLimit: "expensive" },
);
