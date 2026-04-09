import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONES, type PropertyStatus } from "@/lib/types";
import { SECTION_EDITORS, type SectionEditorDef } from "@/config/schemas/section-editors";
import Link from "next/link";

type SectionStatus = "empty" | "in_progress" | "ready";

function evaluateSectionStatus(
  section: SectionEditorDef,
  property: Record<string, unknown>,
): SectionStatus {
  if (!section.completenessFields || section.completenessFields.length === 0) {
    return "empty";
  }
  const allPresent = section.completenessFields.every(
    (field) => property[field] != null && property[field] !== "",
  );
  return allPresent ? "ready" : "empty";
}

function statusToBadge(status: SectionStatus) {
  const map = {
    empty: { label: "Pendiente", tone: "warning" as const },
    in_progress: { label: "En progreso", tone: "neutral" as const },
    ready: { label: "Listo", tone: "success" as const },
  };
  return map[status];
}

/** Only show content-group sections on the overview page */
const OVERVIEW_SECTIONS = SECTION_EDITORS.filter((s) => s.group === "content");

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) notFound();

  const propertyRecord = property as unknown as Record<string, unknown>;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {property.propertyNickname}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
            {[property.city, property.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <Badge
          label={STATUS_LABELS[property.status as PropertyStatus]}
          tone={STATUS_TONES[property.status as PropertyStatus]}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Progreso del contenido
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {OVERVIEW_SECTIONS.map((section) => {
            const status = evaluateSectionStatus(section, propertyRecord);
            const badge = statusToBadge(status);
            return (
              <Link
                key={section.key}
                href={`/properties/${propertyId}/${section.key}`}
                className="flex items-start justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-shadow hover:shadow-sm"
              >
                <div>
                  <h3 className="text-sm font-medium text-[var(--foreground)]">
                    {section.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
                    {section.description}
                  </p>
                </div>
                <Badge label={badge.label} tone={badge.tone} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
