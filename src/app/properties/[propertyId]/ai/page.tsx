import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRenderConfigsForTarget } from "@/config/registries/renderer-registry";
import { Badge } from "@/components/ui/badge";
import { VISIBILITY_ORDER, VISIBILITY_LABEL, VISIBILITY_TONE } from "@/lib/visibility";

export default async function AiViewPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, propertyNickname: true },
  });

  if (!property) notFound();

  // Get all knowledge items eligible for AI view (exclude secret)
  const knowledgeItems = await prisma.knowledgeItem.findMany({
    where: {
      propertyId,
      visibility: { in: ["guest", "ai", "internal"] },
    },
    orderBy: { topic: "asc" },
  });

  // Group by category from renderer config
  const aiConfigs = getRenderConfigsForTarget("ai_view");
  const categories = aiConfigs
    .filter((c) => c.knowledgeCategory)
    .map((c) => ({
      key: c.sectionKey,
      category: c.knowledgeCategory!,
      maxVisibility: c.maxVisibility,
    }));

  // Build export preview as structured Markdown
  const exportLines: string[] = [];
  exportLines.push(`# ${property.propertyNickname ?? "Propiedad"} — Base de conocimiento AI`);
  exportLines.push("");

  for (const cat of categories) {
    const maxLevel = VISIBILITY_ORDER[cat.maxVisibility] ?? 0;
    const eligible = knowledgeItems.filter(
      (item) => (VISIBILITY_ORDER[item.visibility] ?? 99) <= maxLevel,
    );

    if (eligible.length === 0) continue;

    exportLines.push(`## ${cat.category}`);
    exportLines.push("");
    for (const item of eligible) {
      exportLines.push(`### ${item.topic}`);
      exportLines.push("");
      exportLines.push(item.bodyMd);
      exportLines.push("");
    }
  }

  const exportMarkdown = exportLines.join("\n");

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Vista AI
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Previsualización de la base de conocimiento exportable para asistentes AI.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Badge
          label={`${knowledgeItems.length} items elegibles`}
          tone="neutral"
        />
        <Badge
          label={`${categories.length} categorías`}
          tone="neutral"
        />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Vista previa de la exportación
          </h2>
        </div>

        {knowledgeItems.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <p className="text-sm text-[var(--color-neutral-500)]">
              No hay items de conocimiento elegibles para AI. Crea items en la Base de conocimiento.
            </p>
          </div>
        ) : (
          <pre className="mt-4 max-h-[600px] overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--color-neutral-50)] p-4 text-xs text-[var(--foreground)]">
            {exportMarkdown}
          </pre>
        )}
      </div>

      {/* Item list by visibility */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Items por visibilidad
        </h2>
        <div className="space-y-2">
          {knowledgeItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
            >
              <div>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {item.topic}
                </span>
                {item.confidenceScore != null && (
                  <span className="ml-2 text-xs text-[var(--color-neutral-400)]">
                    {Math.round(item.confidenceScore * 100)}%
                  </span>
                )}
              </div>
              <Badge
                label={VISIBILITY_LABEL[item.visibility]}
                tone={VISIBILITY_TONE[item.visibility]}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
