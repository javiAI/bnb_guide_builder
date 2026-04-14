import { redirect } from "next/navigation";

export default async function AmenityDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  redirect(`/properties/${propertyId}/amenities`);
}
