import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AssistantChat } from "@/components/assistant/AssistantChat";

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
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Asistente
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Prueba preguntas contra la base de conocimiento de{" "}
        <strong>{property.propertyNickname ?? "esta propiedad"}</strong>.
        {" "}
        {knowledgeCount} items indexados.
      </p>

      <div className="mt-6">
        <AssistantChat
          propertyId={propertyId}
          defaultLocale={property.defaultLocale ?? "es"}
        />
      </div>
    </div>
  );
}
