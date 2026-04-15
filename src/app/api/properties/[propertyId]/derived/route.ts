import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDerived } from "@/lib/services/property-derived.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Property not found" } },
      { status: 404 },
    );
  }

  const payload = await getDerived(propertyId);
  return NextResponse.json({ data: payload });
}
