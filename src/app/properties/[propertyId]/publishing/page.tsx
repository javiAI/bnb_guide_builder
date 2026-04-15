import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { guideOutputs, getItems } from "@/lib/taxonomy-loader";
import { runAllValidations } from "@/lib/validations/run-all";
import type { ValidationFinding, ValidationSeverity } from "@/lib/validations/cross-validations";
import type { BadgeTone } from "@/lib/types";

type OutputItem = {
  id: string;
  label: string;
  description: string;
  requires?: string[];
};

interface GateResult {
  output: OutputItem;
  ready: boolean;
  missing: string[];
}

function evaluateGates(
  outputs: OutputItem[],
  completedSections: Set<string>,
): GateResult[] {
  return outputs.map((output) => {
    const requires = output.requires ?? [];
    const missing = requires.filter((r) => !completedSections.has(r));
    return {
      output,
      ready: missing.length === 0,
      missing,
    };
  });
}

const SEVERITY_LABEL: Record<ValidationSeverity, string> = {
  blocker: "Bloqueante",
  error: "Error",
  warning: "Aviso",
};

const SEVERITY_TONE: Record<ValidationSeverity, BadgeTone> = {
  blocker: "danger",
  error: "danger",
  warning: "warning",
};

function ValidationsSection({
  validations,
}: {
  validations: { blockers: ValidationFinding[]; errors: ValidationFinding[]; warnings: ValidationFinding[]; all: ValidationFinding[] };
}) {
  if (validations.all.length === 0) return null;
  const ordered: ValidationFinding[] = [
    ...validations.blockers,
    ...validations.errors,
    ...validations.warnings,
  ];
  return (
    <div className="mt-8 space-y-2">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">Validaciones</h2>
      {ordered.map((f) => (
        <div
          key={f.id}
          className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge label={SEVERITY_LABEL[f.severity]} tone={SEVERITY_TONE[f.severity]} />
              <span className="text-sm text-[var(--foreground)]">{f.message}</span>
            </div>
          </div>
          {f.ctaUrl && (
            <Link
              href={f.ctaUrl}
              className="shrink-0 text-xs font-medium text-[var(--color-primary-600)] hover:underline"
            >
              {f.ctaLabel ?? "Ir"}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  basics: "Básicos",
  arrival: "Llegada",
  policies: "Políticas",
  spaces: "Espacios",
  amenities: "Amenities",
  troubleshooting: "Incidencias",
  "local-guide": "Guía local",
  media: "Media",
  media_min: "Media mínima",
  messaging: "Mensajería",
  ops: "Operaciones",
};

export default async function PublishingPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      propertyType: true,
      country: true,
      checkInStart: true,
      primaryAccessMethod: true,
    },
  });

  if (!property) notFound();

  // Evaluate which sections are "complete enough" for publishing gates
  const [spacesCount, amenitiesCount, playbooksCount, localPlacesCount, mediaCount, knowledgeCount, guideVersions, validations] =
    await Promise.all([
      prisma.space.count({ where: { propertyId } }),
      prisma.propertyAmenityInstance.count({ where: { propertyId } }),
      prisma.troubleshootingPlaybook.count({ where: { propertyId } }),
      prisma.localPlace.count({ where: { propertyId } }),
      prisma.mediaAsset.count({ where: { propertyId } }),
      prisma.knowledgeItem.count({ where: { propertyId } }),
      prisma.guideVersion.findMany({
        where: { propertyId },
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, status: true, version: true, publishedAt: true },
      }),
      runAllValidations(propertyId),
    ]);

  const completedSections = new Set<string>();

  // Basics gate: need propertyType and country
  if (property.propertyType && property.country) {
    completedSections.add("basics");
  }

  // Arrival gate: need checkInStart and access method
  if (property.checkInStart && property.primaryAccessMethod) {
    completedSections.add("arrival");
  }

  // Policies: consider present if basics is (policies are optional with defaults)
  if (property.propertyType) {
    completedSections.add("policies");
  }

  // Others based on count
  if (spacesCount > 0) completedSections.add("spaces");
  if (amenitiesCount > 0) completedSections.add("amenities");
  if (playbooksCount > 0) completedSections.add("troubleshooting");
  if (localPlacesCount > 0) completedSections.add("local-guide");
  if (mediaCount > 0) {
    completedSections.add("media");
    completedSections.add("media_min");
  }

  const outputs = getItems(guideOutputs) as OutputItem[];
  const gates = evaluateGates(outputs, completedSections);

  const readyCount = gates.filter((g) => g.ready).length;
  const latestVersion = guideVersions[0] ?? null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Publicación
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Estado de los outputs y acciones de publicación.
      </p>

      {/* Summary */}
      <div className="mt-6 flex items-center gap-3">
        <Badge
          label={`${readyCount}/${gates.length} outputs listos`}
          tone={readyCount === gates.length ? "success" : "warning"}
        />
        {latestVersion && (
          <Badge
            label={`Guía v${latestVersion.version} — ${latestVersion.status === "published" ? "publicada" : "borrador"}`}
            tone={latestVersion.status === "published" ? "success" : "warning"}
          />
        )}
        <Badge label={`${knowledgeCount} items de conocimiento`} tone="neutral" />
      </div>

      {/* Cross-validations: blockers / errors / warnings */}
      <ValidationsSection validations={validations} />

      {/* Gate results */}
      <div className="mt-8 space-y-3">
        {gates.map((gate) => {
          const tone: BadgeTone = gate.ready ? "success" : "danger";
          return (
            <div
              key={gate.output.id}
              className="flex items-start justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-[var(--foreground)]">
                    {gate.output.label}
                  </h3>
                  <Badge
                    label={gate.ready ? "Listo" : "Bloqueado"}
                    tone={tone}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
                  {gate.output.description}
                </p>
                {gate.missing.length > 0 && (
                  <p className="mt-2 text-xs text-[var(--color-danger-600)]">
                    Falta: {gate.missing.map((m) => SECTION_LABELS[m] ?? m).join(", ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Section completeness overview */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Estado de secciones
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SECTION_LABELS).map(([key, label]) => {
            const done = completedSections.has(key);
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <span className="text-sm text-[var(--foreground)]">{label}</span>
                <Badge
                  label={done ? "Completo" : "Pendiente"}
                  tone={done ? "success" : "neutral"}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
