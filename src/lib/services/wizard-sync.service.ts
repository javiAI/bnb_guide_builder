import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Wizard → canonical entity sync.
 *
 * Per SYSTEM_ARCHITECTURE §3:
 *   "wizard save writes raw responses and updates canonical entities
 *    in the same transaction where feasible"
 *
 * Per DATA_MODEL_AND_PERSISTENCE §1:
 *   "WizardResponse guarda captura y continuidad, no reemplaza entidades canónicas"
 */

interface WizardStep1Data {
  propertyType: string;
  roomType: string;
}

interface WizardStep2Data {
  country: string;
  city: string;
  region?: string;
  postalCode?: string;
  streetAddress?: string;
  addressLevel?: string;
  timezone: string;
}

interface WizardStep3Data {
  maxGuests: number;
  bedroomsCount: number;
  bedsCount: number;
  bathroomsCount: number;
}

interface WizardStep4Data {
  checkInStart: string;
  checkInEnd: string;
  checkOutTime: string;
  primaryAccessMethod: string;
  hostContactPhone?: string;
  supportContact?: string;
}

export type WizardStepData =
  | { step: 1; data: WizardStep1Data }
  | { step: 2; data: WizardStep2Data }
  | { step: 3; data: WizardStep3Data }
  | { step: 4; data: WizardStep4Data };

function stepDataToPropertyUpdate(input: WizardStepData): Prisma.PropertyUpdateInput {
  switch (input.step) {
    case 1:
      return {
        propertyType: input.data.propertyType,
        roomType: input.data.roomType,
      };
    case 2:
      return {
        country: input.data.country,
        city: input.data.city,
        region: input.data.region ?? null,
        postalCode: input.data.postalCode ?? null,
        streetAddress: input.data.streetAddress ?? null,
        addressLevel: input.data.addressLevel ?? null,
        timezone: input.data.timezone,
      };
    case 3:
      return {
        maxGuests: input.data.maxGuests,
        bedroomsCount: input.data.bedroomsCount,
        bedsCount: input.data.bedsCount,
        bathroomsCount: input.data.bathroomsCount,
      };
    case 4:
      return {
        checkInStart: input.data.checkInStart,
        checkInEnd: input.data.checkInEnd,
        checkOutTime: input.data.checkOutTime,
        primaryAccessMethod: input.data.primaryAccessMethod,
        hostContactPhone: input.data.hostContactPhone ?? null,
        supportContact: input.data.supportContact ?? null,
      };
  }
}

function stepDataToFieldEntries(input: WizardStepData): Array<{ fieldKey: string; value: Prisma.InputJsonValue }> {
  return Object.entries(input.data).map(([key, value]) => ({
    fieldKey: key,
    value: value as Prisma.InputJsonValue,
  }));
}

/**
 * Save a wizard step: persists raw responses AND updates the canonical Property
 * in a single transaction.
 */
export async function saveWizardStep(
  sessionId: string,
  propertyId: string,
  input: WizardStepData,
) {
  const propertyUpdate = stepDataToPropertyUpdate(input);
  const fieldEntries = stepDataToFieldEntries(input);

  return prisma.$transaction(async (tx) => {
    // 1. Write raw responses for replay / continuity / audit
    for (const entry of fieldEntries) {
      await tx.wizardResponse.create({
        data: {
          wizardSession: { connect: { id: sessionId } },
          stepNumber: input.step,
          fieldKey: entry.fieldKey,
          valueJson: entry.value,
        },
      });
    }

    // 2. Advance wizard session step
    await tx.wizardSession.update({
      where: { id: sessionId },
      data: { currentStep: input.step + 1 },
    });

    // 3. Update canonical Property entity with typed columns
    const property = await tx.property.update({
      where: { id: propertyId },
      data: propertyUpdate,
    });

    return property;
  });
}

/**
 * Complete wizard: mark session as completed and activate the property.
 */
export async function completeWizard(sessionId: string, propertyId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.wizardSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    return tx.property.update({
      where: { id: propertyId },
      data: { status: "active" },
    });
  });
}

/**
 * Create a new property draft with a wizard session ready.
 */
export async function createPropertyDraft(
  workspaceId: string,
  nickname: string,
) {
  return prisma.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        propertyNickname: nickname,
        status: "draft",
      },
    });

    const session = await tx.wizardSession.create({
      data: {
        property: { connect: { id: property.id } },
        status: "in_progress",
        currentStep: 1,
      },
    });

    return { property, session };
  });
}
