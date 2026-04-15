import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONES, type PropertyStatus } from "@/lib/types";
import { getDerived } from "@/lib/services/property-derived.service";
import { runAllValidations } from "@/lib/validations/run-all";
import { CapacityCard } from "@/components/overview/capacity-card";
import { GapsCard } from "@/components/overview/gaps-card";
import { PublishReadinessCard } from "@/components/overview/publish-readiness-card";
import { NextActionCard } from "@/components/overview/next-action-card";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      propertyNickname: true,
      city: true,
      country: true,
      status: true,
      maxGuests: true,
      infantsAllowed: true,
      accessMethodsJson: true,
    },
  });

  if (!property) notFound();

  // Derived + validations fan out in parallel. Both tolerate partial data and
  // degrade gracefully (getDerived recomputes on miss; runAllValidations
  // returns empty arrays when the property isn't found).
  const [derived, validations] = await Promise.all([
    getDerived(propertyId),
    runAllValidations(propertyId, {
      maxGuests: property.maxGuests,
      infantsAllowed: property.infantsAllowed,
      accessMethodsJson: property.accessMethodsJson,
    }),
  ]);

  const { readiness, sleepingCapacity } = derived;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {property.propertyNickname}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
            {[property.city, property.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <Badge
          label={STATUS_LABELS[property.status as PropertyStatus]}
          tone={STATUS_TONES[property.status as PropertyStatus]}
        />
      </div>

      <div className="mt-6">
        <NextActionCard
          propertyId={propertyId}
          scores={readiness.scores}
          blockers={validations.blockers}
          errors={validations.errors}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PublishReadinessCard
          propertyId={propertyId}
          overall={readiness.overall}
          usable={readiness.usable}
          publishable={readiness.publishable}
          blockers={validations.blockers}
          errors={validations.errors}
        />
        <CapacityCard
          propertyId={propertyId}
          maxGuests={property.maxGuests}
          sleepingCapacity={sleepingCapacity.total}
        />
        <div className="lg:col-span-2">
          <GapsCard propertyId={propertyId} scores={readiness.scores} />
        </div>
      </div>
    </div>
  );
}
