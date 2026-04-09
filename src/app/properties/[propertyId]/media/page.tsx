import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { mediaAssetRoles, getItems } from "@/lib/taxonomy-loader";
import { getMediaRequirementsForSection } from "@/config/registries/media-registry";
import { CreateMediaForm } from "./create-media-form";

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
    include: { assignments: true },
    orderBy: { createdAt: "desc" },
  });

  // Check for security warnings: public assets that might contain secrets
  const publicAssets = assets.filter((a) => a.visibility === "public");
  const sensitiveRoles = ["lockbox", "keypad", "smart_lock", "access_code"];
  const securityWarnings = publicAssets.filter((a) =>
    sensitiveRoles.some((role) => a.assetRoleKey.includes(role)),
  );

  // Media requirements from taxonomy
  const arrivalReqs = getMediaRequirementsForSection("arrival");
  const basicsReqs = getMediaRequirementsForSection("basics");

  const roleLabels = new Map(
    getItems(mediaAssetRoles).map((r) => [r.id, r.label]),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Mediateca
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Fotos y vídeos organizados como assets reutilizables.
      </p>

      {securityWarnings.length > 0 && (
        <div className="mt-4">
          <Banner
            type="danger"
            message={`${securityWarnings.length} asset(s) públicos pueden contener información sensible (lockbox, código, etc.). Revisa su visibilidad.`}
          />
        </div>
      )}

      {/* Media requirements prompts */}
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

      {/* Asset list */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Assets ({assets.length})
        </h2>

        {assets.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Sin assets todavía
            </h3>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Sube fotos y vídeos para documentar tu propiedad.
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
                    </div>
                  </div>
                  <Badge label={statusBadge.label} tone={statusBadge.tone} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create asset */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Registrar asset
        </h2>
        <CreateMediaForm propertyId={propertyId} />
      </div>
    </div>
  );
}
