import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { findItem, propertyTypes } from "@/lib/taxonomy-loader";
import { Step4Form } from "./step-4-form";

interface Props {
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function Step4Page({ searchParams }: Props) {
  const { sessionId } = await searchParams;
  if (!sessionId) redirect("/properties/new/welcome");

  const session = await prisma.wizardSession.findUnique({
    where: { id: sessionId },
    select: { stateJson: true, currentStep: true },
  });

  if (!session) redirect("/properties/new/welcome");

  const state = (session.stateJson as Record<string, unknown>) ?? {};

  // Determine if building access is needed based on property type
  const propertyTypeId = state.propertyType as string | undefined;
  const ptItem = propertyTypeId ? findItem(propertyTypes, propertyTypeId) : null;
  // requiresBuildingAccess is a custom field in property_types taxonomy
  const ptRaw = ptItem as Record<string, unknown> | undefined;
  const rba = ptRaw?.requiresBuildingAccess;
  const requiresBuildingAccess: boolean | string = typeof rba === "boolean" || typeof rba === "string" ? rba : "ask";

  return (
    <Step4Form
      sessionId={sessionId}
      initialState={state}
      requiresBuildingAccess={requiresBuildingAccess}
      maxStepReached={session.currentStep}
      snapshot={state}
      snapshotStep={session.currentStep}
    />
  );
}
