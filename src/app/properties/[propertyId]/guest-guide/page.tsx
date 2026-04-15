import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { GuidePreview } from "@/components/guide-preview";
import { CreateGuideVersionButton } from "./create-guide-version-button";
import { GuideVersionDetail } from "./guide-version-detail";

export default async function GuestGuidePage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) notFound();

  const versions = await prisma.guideVersion.findMany({
    where: { propertyId },
    orderBy: { version: "desc" },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  const latestDraft = versions.find((v) => v.status === "draft");
  const publishedVersions = versions.filter((v) => v.status === "published");

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Guía del huésped
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Previsualización y versionado de la guía publicable.
      </p>

      <div className="mt-8">
        <GuidePreview propertyId={propertyId} />
      </div>

      <div className="mt-8">
        {/* Draft section */}
        {latestDraft ? (
          <GuideVersionDetail
            version={{
              id: latestDraft.id,
              version: latestDraft.version,
              status: latestDraft.status,
              sections: latestDraft.sections.map((s) => ({
                id: s.id,
                sectionKey: s.sectionKey,
                title: s.title,
                sortOrder: s.sortOrder,
                items: s.items.map((i) => ({
                  id: i.id,
                  contentMd: i.contentMd,
                  visibility: i.visibility,
                  sortOrder: i.sortOrder,
                })),
              })),
            }}
            propertyId={propertyId}
          />
        ) : (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Sin borrador activo
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Crea una nueva versión de guía para empezar a componer contenido.
            </p>
            <div className="mt-4">
              <CreateGuideVersionButton propertyId={propertyId} />
            </div>
          </div>
        )}

        {/* Published versions */}
        {publishedVersions.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              Versiones publicadas
            </h2>
            <div className="space-y-2">
              {publishedVersions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      Versión {v.version}
                    </span>
                    <span className="ml-3 text-xs text-[var(--color-neutral-500)]">
                      Publicada: {v.publishedAt?.toLocaleDateString("es-ES") ?? "—"}
                    </span>
                  </div>
                  <Badge label="Publicada" tone="success" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
