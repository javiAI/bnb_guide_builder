import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PoliciesForm } from "./policies-form";
import type { PoliciesData } from "@/lib/schemas/editor.schema";

const DEFAULT_POLICIES: PoliciesData = {
  quietHours: { enabled: false },
  smoking: "not_allowed",
  events: { policy: "not_allowed" },
  commercialPhotography: "not_allowed",
  pets: { allowed: false },
  supplements: {
    cleaning: { enabled: false },
    extraGuest: { enabled: false },
  },
  services: { allowed: false },
};

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      policiesJson: true,
      maxGuests: true,
    },
  });

  if (!property) notFound();

  const saved = property.policiesJson as Partial<PoliciesData> | null;
  const policies: PoliciesData = saved
    ? {
        ...DEFAULT_POLICIES,
        ...saved,
        supplements: {
          cleaning: { ...DEFAULT_POLICIES.supplements.cleaning, ...saved.supplements?.cleaning },
          extraGuest: { ...DEFAULT_POLICIES.supplements.extraGuest, ...saved.supplements?.extraGuest },
        },
      }
    : DEFAULT_POLICIES;

  return (
    <PoliciesForm
      propertyId={propertyId}
      policies={policies}
      propertyDefaults={{
        maxGuests: property.maxGuests,
      }}
    />
  );
}
