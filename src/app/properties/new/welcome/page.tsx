import { prisma } from "@/lib/db";
import { WelcomeForm } from "./welcome-form";

interface Props {
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function WelcomePage({ searchParams }: Props) {
  const { sessionId } = await searchParams;

  let initialNickname = "";
  if (sessionId) {
    const session = await prisma.wizardSession.findUnique({
      where: { id: sessionId },
      select: { propertyNickname: true },
    });
    if (session?.propertyNickname) {
      initialNickname = session.propertyNickname;
    }
  }

  return <WelcomeForm initialNickname={initialNickname} sessionId={sessionId} />;
}
