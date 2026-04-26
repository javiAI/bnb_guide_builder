import { NextResponse } from "next/server";
import { getDerived } from "@/lib/services/property-derived.service";
import { withOperatorGuards } from "@/lib/auth/operator-guards";

export const GET = withOperatorGuards<{ propertyId: string }>(
  async (_request, { params }) => {
    const payload = await getDerived(params.propertyId);
    return NextResponse.json({ data: payload });
  },
  { rateLimit: "read" },
);
