import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { mediaAssetRoles, getItems } from "@/lib/taxonomy-loader";
import { getMediaRequirementsForSection } from "@/config/registries/media-registry";
import { ENTITY_TYPE_LABELS, type MediaEntityType } from "@/lib/schemas/editor.schema";
import { MediaPageClient } from "./media-page-client";

const ASSET_STATUS_BADGE: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  pending: { label: "Pendiente", tone: "warning" },
  uploaded: { label: "Subido", tone: "success" },
  processing: { label: "Procesando", tone: "neutral" },
  ready: { label: "Listo", tone: "success" },
};

export default async function MediaPage({
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

  const assets = await prisma.mediaAsset.findMany({
    where: { propertyId },
    select: {
      id: true,
      assetRoleKey: true,
      mediaType: true,
      visibility: true,
      status: true,
      caption: true,
      assignments: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          entityType: true,
          entityId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Security warnings
  const guestAssets = assets.filter((a) => a.visibility === "guest");
  const sensitiveRoles = ["lockbox", "keypad", "smart_lock", "access_code"];
  const securityWarnings = guestAssets.filter((a) =>
    sensitiveRoles.some((role) => a.assetRoleKey.includes(role)),
  );

  // Media requirements
  const arrivalReqs = getMediaRequirementsForSection("arrival");
  const basicsReqs = getMediaRequirementsForSection("basics");

  const roleLabels = new Map(
    getItems(mediaAssetRoles).map((r) => [r.id, r.label]),
  );

  // Group assignments by entity
  const assignmentsByEntity = new Map<string, { entityType: string; entityId: string; count: number }>();
  for (const asset of assets) {
    for (const assignment of asset.assignments) {
      const key = `${assignment.entityType}:${assignment.entityId}`;
      const existing = assignmentsByEntity.get(key);
      if (existing) {
        existing.count++;
      } else {
        assignmentsByEntity.set(key, {
          entityType: assignment.entityType,
          entityId: assignment.entityId,
          count: 1,
        });
      }
    }
  }

  const totalAssigned = assets.filter((a) => a.assignments.length > 0).length;
  const totalUnassigned = assets.filter((a) => a.assignments.length === 0).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Mediateca
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Fotos y vídeos de tu propiedad. Sube archivos aquí o directamente desde cada sección.
      </p>

      {securityWarnings.length > 0 && (
        <div className="mt-4">
          <Banner
            type="danger"
            message={`${securityWarnings.length} asset(s) públicos pueden contener información sensible (lockbox, código, etc.). Revisa su visibilidad.`}
          />
        </div>
      )}

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-center">
          <p className="text-2xl font-bold text-[var(--foreground)]">{assets.length}</p>
          <p className="text-xs text-[var(--color-neutral-500)]">Total assets</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-center">
          <p className="text-2xl font-bold text-[var(--color-success-600)]">{totalAssigned}</p>
          <p className="text-xs text-[var(--color-neutral-500)]">Asignados</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-center">
          <p className="text-2xl font-bold text-[var(--color-warning-600)]">{totalUnassigned}</p>
          <p className="text-xs text-[var(--color-neutral-500)]">Sin asignar</p>
        </div>
      </div>

      {/* Media requirements */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Media recomendada
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[...basicsReqs, ...arrivalReqs].map((req) => {
            const hasAsset = assets.some((a) => a.assetRoleKey === req.id);
            return (
              <div
                key={req.id}
                className={`rounded-[var(--radius-md)] border px-3 py-2 text-xs ${
                  hasAsset
                    ? "border-[var(--color-success-200)] bg-[var(--color-success-50)] text-[var(--color-success-700)]"
                    : "border-[var(--color-neutral-200)] text-[var(--color-neutral-600)]"
                }`}
              >
                <span className="font-medium">{req.label}</span>
                {hasAsset ? " — Completado" : " — Pendiente"}
              </div>
            );
          })}
        </div>
      </div>

      {/* Property-level gallery + upload */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Fotos de la propiedad
        </h2>
        <MediaPageClient propertyId={propertyId} />
      </div>

      {/* Assignments by entity */}
      {assignmentsByEntity.size > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Media por sección
          </h2>
          <div className="space-y-2">
            {Array.from(assignmentsByEntity.values()).map((group) => (
              <div
                key={`${group.entityType}:${group.entityId}`}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    label={ENTITY_TYPE_LABELS[group.entityType as MediaEntityType] ?? group.entityType}
                    tone="neutral"
                  />
                  <span className="text-sm text-[var(--color-neutral-600)]">
                    {group.entityId.slice(0, 8)}…
                  </span>
                </div>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {group.count} {group.count === 1 ? "foto" : "fotos"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All assets list (for management) */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Todos los assets ({assets.length})
        </h2>

        {assets.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Sin assets todavía
            </h3>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Sube fotos y vídeos arrastrando archivos al área de arriba.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => {
              const statusBadge = ASSET_STATUS_BADGE[asset.status] ?? ASSET_STATUS_BADGE.pending;
              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {asset.caption || roleLabels.get(asset.assetRoleKey) || asset.assetRoleKey}
                      </span>
                      <span className="text-xs text-[var(--color-neutral-400)]">
                        {asset.mediaType}
                      </span>
                    </div>
                    <div className="mt-0.5 flex gap-2 text-xs text-[var(--color-neutral-500)]">
                      <span>{asset.visibility}</span>
                      {asset.assignments.length > 0 && (
                        <span>{asset.assignments.length} asignaciones</span>
                      )}
                      {asset.assignments.length === 0 && (
                        <span className="text-[var(--color-warning-600)]">Sin asignar</span>
                      )}
                    </div>
                  </div>
                  <Badge label={statusBadge.label} tone={statusBadge.tone} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
