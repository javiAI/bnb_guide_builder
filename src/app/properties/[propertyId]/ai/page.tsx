import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { ModuleContainer } from "@/components/layout/module-container";

export default async function AiViewPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, propertyNickname: true, defaultLocale: true },
  });
  if (!property) notFound();

  const knowledgeCount = await prisma.knowledgeItem.count({
    where: {
      propertyId,
      visibility: { in: ["guest", "ai", "internal"] },
    },
  });

  return (
    <ModuleContainer
      eyebrow="Propiedad · Asistente"
      title="Asistente IA"
      description={
        <>
          Prueba preguntas contra la base de conocimiento de{" "}
          <strong className="font-semibold text-[var(--color-text-primary)]">
            {property.propertyNickname ?? "esta propiedad"}
          </strong>
          . {knowledgeCount} items indexados.
        </>
      }
    >
      <AssistantChat
        propertyId={propertyId}
        defaultLocale={property.defaultLocale ?? "es"}
      />
    </ModuleContainer>
  );
}
