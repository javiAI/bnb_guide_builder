import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSystemGroups, findSystemItem } from "@/lib/taxonomy-loader";
import { CreateSystemForm } from "./create-system-form";

export default async function SystemsPage({
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

  const systems = await prisma.propertySystem.findMany({
    where: { propertyId },
    orderBy: { createdAt: "asc" },
  });

  const groups = getSystemGroups();
  const existingKeys = new Set(systems.map((s) => s.systemKey));

  // Group installed systems by taxonomy group
  const installedByGroup = groups.map((group) => ({
    group,
    installed: systems.filter((s) => group.items.some((i) => i.id === s.systemKey)),
  })).filter((g) => g.installed.length > 0);

  // Recommended systems not yet added
  const recommended = groups
    .flatMap((g) => g.items)
    .filter((i) => i.recommended && !existingKeys.has(i.id));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Sistemas</h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
            Climatización, agua caliente, electricidad y conectividad.
          </p>
        </div>
      </div>

      {/* Recommended hint */}
      {recommended.length > 0 && systems.length === 0 && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3">
          <p className="text-xs text-[var(--color-primary-700)]">
            Sistemas recomendados para configurar:{" "}
            <span className="font-medium">{recommended.map((i) => i.label).join(", ")}</span>
          </p>
        </div>
      )}

      {/* Installed systems */}
      {systems.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Sin sistemas configurados</h2>
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            Añade el primer sistema usando el formulario de abajo.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {installedByGroup.map(({ group, installed }) => (
            <div key={group.id}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-400)]">
                {group.label}
              </h2>
              <div className="space-y-2">
                {installed.map((sys) => {
                  const item = findSystemItem(sys.systemKey);
                  const details = sys.detailsJson as Record<string, unknown> | null;
                  const configuredCount = details
                    ? Object.values(details).filter((v) => v !== null && v !== "").length
                    : 0;
                  return (
                    <Link
                      key={sys.id}
                      href={`/properties/${propertyId}/systems/${sys.id}`}
                      className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)] transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {item?.label ?? sys.systemKey}
                        </p>
                        {configuredCount > 0 && (
                          <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
                            {configuredCount} campo{configuredCount !== 1 ? "s" : ""} configurado{configuredCount !== 1 ? "s" : ""}
                          </p>
                        )}
                        {configuredCount === 0 && (
                          <p className="mt-0.5 text-xs text-[var(--color-neutral-400)]">Sin detalles aún</p>
                        )}
                      </div>
                      <span className="text-xs text-[var(--color-primary-500)]">Configurar →</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="mt-10 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Añadir sistema</h2>
        <CreateSystemForm propertyId={propertyId} existingKeys={Array.from(existingKeys)} />
      </div>
    </div>
  );
}
