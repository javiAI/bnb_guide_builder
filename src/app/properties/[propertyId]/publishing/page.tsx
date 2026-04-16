import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { guideOutputs, getItems } from "@/lib/taxonomy-loader";
import { runAllValidations } from "@/lib/validations/run-all";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import { computeGuideDiff } from "@/lib/services/guide-diff.service";
import { Prisma } from "@prisma/client";
import type { GuideTree } from "@/lib/types/guide-tree";
import type { ValidationFinding, ValidationSeverity } from "@/lib/validations/cross-validations";
import type { BadgeTone } from "@/lib/types";
import QRCode from "qrcode";
import { PublishButton, UnpublishButton, RollbackButton } from "./publish-actions";
import { GuideDiffViewer } from "./guide-diff-viewer";
import { ShareableLink } from "./shareable-link";

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
      maxGuests: true,
      infantsAllowed: true,
      accessMethodsJson: true,
      publicSlug: true,
    },
  });

  if (!property) notFound();

  // Load data in parallel — versions fetched without treeJson (large blob);
  // published version's treeJson is fetched separately only if needed.
  const [
    spacesCount,
    amenitiesCount,
    playbooksCount,
    localPlacesCount,
    mediaCount,
    knowledgeCount,
    versions,
    validations,
    publishedWithTree,
  ] = await Promise.all([
    prisma.space.count({ where: { propertyId, status: "active" } }),
    prisma.propertyAmenityInstance.count({ where: { propertyId } }),
    prisma.troubleshootingPlaybook.count({ where: { propertyId } }),
    prisma.localPlace.count({ where: { propertyId } }),
    prisma.mediaAsset.count({ where: { propertyId } }),
    prisma.knowledgeItem.count({ where: { propertyId } }),
    prisma.guideVersion.findMany({
      where: { propertyId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
    runAllValidations(propertyId, {
      maxGuests: property.maxGuests,
      infantsAllowed: property.infantsAllowed,
      accessMethodsJson: property.accessMethodsJson,
    }),
    // Only fetch treeJson for the published version
    prisma.guideVersion.findFirst({
      where: { propertyId, status: "published" },
      orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, treeJson: true, publishedAt: true, createdAt: true },
    }),
  ]);

  const completedSections = new Set<string>();

  if (property.propertyType && property.country) completedSections.add("basics");
  if (property.checkInStart && property.primaryAccessMethod) completedSections.add("arrival");
  if (property.propertyType) completedSections.add("policies");
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

  const publishedVersion = publishedWithTree ?? versions.find((v) => v.status === "published") ?? null;
  const publishedHasSnapshot = Boolean(publishedWithTree?.treeJson);
  // For archived versions, check which ones have snapshots (for rollback eligibility).
  // This is a lightweight query — only IDs, no large treeJson payloads.
  const archivedIds = versions.filter((v) => v.status === "archived").map((v) => v.id);
  const snapshotIds = archivedIds.length > 0
    ? new Set(
        (await prisma.guideVersion.findMany({
          where: { id: { in: archivedIds }, treeJson: { not: Prisma.AnyNull } },
          select: { id: true },
        })).map((v) => v.id),
      )
    : new Set<string>();
  const archivedVersions = versions
    .filter((v) => v.status === "archived")
    .map((v) => ({ ...v, hasSnapshot: snapshotIds.has(v.id) }));

  // Shareable link — generate QR SVG server-side when slug exists
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const publicUrl = property.publicSlug
    ? `${baseUrl}/g/${property.publicSlug}`
    : null;
  const qrSvg = publicUrl
    ? await QRCode.toString(publicUrl, { type: "svg", margin: 1, width: 200 })
    : null;

  // Only compose live tree + diff when there's a published version to compare against
  const publishedTree = publishedWithTree?.treeJson
    ? (publishedWithTree.treeJson as unknown as GuideTree)
    : null;
  const liveTree = publishedTree ? await composeGuide(propertyId, "internal") : null;
  const diff = computeGuideDiff(publishedTree, liveTree);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Publicación
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Publica una versión inmutable de la guía. Cada publicación congela el estado actual.
      </p>

      {/* Summary badges */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge
          label={`${readyCount}/${gates.length} outputs listos`}
          tone={readyCount === gates.length ? "success" : "warning"}
        />
        {publishedVersion && (
          <Badge
            label={`v${publishedVersion.version} publicada`}
            tone="success"
          />
        )}
        {!publishedVersion && (
          <Badge label="Sin versión publicada" tone="neutral" />
        )}
        <Badge label={`${knowledgeCount} items de conocimiento`} tone="neutral" />
      </div>

      {/* ── Publish action ── */}
      <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {publishedVersion ? "Publicar nueva versión" : "Primera publicación"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {publishedVersion
                ? "Se creará una nueva versión con el estado actual de la propiedad."
                : "Congela el estado actual de la guía en una versión inmutable."}
            </p>
          </div>
          <PublishButton propertyId={propertyId} />
        </div>
      </div>

      {/* ── Diff vs published ── */}
      {publishedVersion && publishedHasSnapshot && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Cambios desde v{publishedVersion.version}
          </h2>
          <GuideDiffViewer diff={diff} />
        </div>
      )}
      {publishedVersion && !publishedHasSnapshot && (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] p-4">
          <p className="text-sm text-[var(--color-warning-700)]">
            La versión publicada v{publishedVersion.version} no tiene snapshot (anterior a 9C). Publica una nueva versión para habilitar comparación y rollback.
          </p>
        </div>
      )}

      {/* ── Published version ── */}
      {publishedVersion && (
        <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Versión {publishedVersion.version}
                </h2>
                <Badge label="Publicada" tone="success" />
              </div>
              <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
                Publicada: {publishedVersion.publishedAt?.toLocaleString("es-ES", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) ?? "—"}
              </p>
            </div>
            <UnpublishButton versionId={publishedVersion.id} />
          </div>
        </div>
      )}

      {/* ── Shareable link ── */}
      {publishedVersion && publicUrl && qrSvg && (
        <ShareableLink url={publicUrl} qrSvg={qrSvg} />
      )}

      {/* ── Version history ── */}
      {archivedVersions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Historial de versiones
          </h2>
          <div className="space-y-2">
            {archivedVersions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    Versión {v.version}
                  </span>
                  <span className="text-xs text-[var(--color-neutral-500)]">
                    {v.publishedAt?.toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" }) ?? v.createdAt.toLocaleDateString("es-ES")}
                  </span>
                  <Badge label="Archivada" tone="neutral" />
                </div>
                {v.hasSnapshot && (
                  <RollbackButton sourceVersionId={v.id} version={v.version} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-validations */}
      <ValidationsSection validations={validations} />

      {/* Gate results */}
      <div className="mt-8 space-y-3">
        <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
          Requisitos por output
        </h2>
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
