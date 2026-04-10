import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
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

  return (
    <Step4Form
      sessionId={sessionId}
      initialState={state}
      maxStepReached={session.currentStep}
      snapshot={state}
      snapshotStep={session.currentStep}
    />
  );
}
