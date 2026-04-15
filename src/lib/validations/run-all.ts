import { prisma } from "@/lib/db";
import {
  validateWifiComplete,
  validateSmartLockBackup,
  validateCapacityCoherence,
  validateInfantsVsCrib,
  validateVisibilityLeaks,
  type ValidationContext,
  type ValidationFinding,
} from "./cross-validations";

export interface ValidationReport {
  blockers: ValidationFinding[];
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  all: ValidationFinding[];
}

const VALIDATORS = [
  validateWifiComplete,
  validateSmartLockBackup,
  validateCapacityCoherence,
  validateInfantsVsCrib,
  validateVisibilityLeaks,
] as const;

/**
 * Loads everything the cross-validations need and runs them. Single roundtrip
 * via parallel queries; the validators themselves are pure and unit-tested.
 */
export async function runAllValidations(propertyId: string): Promise<ValidationReport> {
  const [property, systems, amenityInstances, beds] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        maxGuests: true,
        infantsAllowed: true,
        accessMethodsJson: true,
      },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { systemKey: true, detailsJson: true, visibility: true },
    }),
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: {
        amenityKey: true,
        subtypeKey: true,
        detailsJson: true,
        visibility: true,
      },
    }),
    prisma.bedConfiguration.findMany({
      where: { space: { propertyId } },
      select: { bedType: true, quantity: true, configJson: true },
    }),
  ]);

  if (!property) {
    return { blockers: [], errors: [], warnings: [], all: [] };
  }

  const ctx: ValidationContext = {
    propertyId,
    maxGuests: property.maxGuests,
    infantsAllowed: property.infantsAllowed,
    accessMethodsJson:
      (property.accessMethodsJson as ValidationContext["accessMethodsJson"]) ?? null,
    systems,
    amenityInstances,
    beds: beds.map((b) => ({
      bedType: b.bedType,
      quantity: b.quantity,
      configJson: (b.configJson ?? null) as Record<string, unknown> | null,
    })),
  };

  const all = VALIDATORS.flatMap((fn) => fn(ctx));

  return {
    blockers: all.filter((f) => f.severity === "blocker"),
    errors: all.filter((f) => f.severity === "error"),
    warnings: all.filter((f) => f.severity === "warning"),
    all,
  };
}
