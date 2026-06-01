import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { ModuleContainer } from "@/components/layout/module-container";
import { KnowledgePanel } from "../knowledge/knowledge-panel";

/**
 * Asistente IA — the assistant's home (Liora 16F.5). Knowledge management + the
 * chat in one view (no tabs): the knowledge base that feeds the assistant on the
 * left, the chat to test it on the right. The chat also lives in the right rail
 * (docked) + a floating bubble (when the rail is collapsed/absent).
 */
export default async function AiViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { propertyId } = await params;
  const { locale } = await searchParams;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, defaultLocale: true },
  });
  if (!property) notFound();

  const defaultLocale = property.defaultLocale ?? "es";

  return (
    <ModuleContainer
      eyebrow="Propiedad · Asistente IA"
      title="Asistente IA"
      description="La base de conocimiento que alimenta al asistente y el chat para probarlo — en un mismo lugar."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_minmax(360px,38%)]">
        <section aria-label="Base de conocimiento">
          <h2 className="mb-3 text-[15px] font-semibold text-[var(--color-text-primary)]">
            Base de conocimiento
          </h2>
          <KnowledgePanel
            propertyId={propertyId}
            defaultLocale={defaultLocale}
            localeParam={locale}
          />
        </section>
        <aside
          aria-label="Probar el asistente"
          className="xl:sticky xl:top-[calc(var(--topbar-height)+1.5rem)] xl:self-start"
        >
          <h2 className="mb-3 text-[15px] font-semibold text-[var(--color-text-primary)]">
            Probar el asistente
          </h2>
          <div className="h-[min(640px,calc(100vh-var(--topbar-height)-9rem))] rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-3">
            <AssistantChat propertyId={propertyId} defaultLocale={defaultLocale} fill />
          </div>
        </aside>
      </div>
    </ModuleContainer>
  );
}
