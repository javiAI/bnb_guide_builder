import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { OpsChecklistSection } from "./ops-checklist-section";
import { OpsStockSection } from "./ops-stock-section";
import { OpsMaintenanceSection } from "./ops-maintenance-section";

export default async function OpsPage({
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

  const [checklistItems, stockItems, maintenanceTasks] = await Promise.all([
    prisma.opsChecklistItem.findMany({
      where: { propertyId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.stockItem.findMany({
      where: { propertyId },
      orderBy: { name: "asc" },
    }),
    prisma.maintenanceTask.findMany({
      where: { propertyId },
      orderBy: { nextDueAt: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Limpieza y operaciones
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Checklists, stock y mantenimiento.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Badge label={`${checklistItems.length} tareas`} tone="neutral" />
        <Badge label={`${stockItems.length} items stock`} tone="neutral" />
        <Badge label={`${maintenanceTasks.length} mantenimiento`} tone="neutral" />
      </div>

      {/* Checklist */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Checklist de limpieza
        </h2>
        <OpsChecklistSection
          items={checklistItems.map((i) => ({
            id: i.id,
            scopeKey: i.scopeKey,
            title: i.title,
            detailsMd: i.detailsMd,
            estimatedMinutes: i.estimatedMinutes,
            required: i.required,
          }))}
          propertyId={propertyId}
        />
      </div>

      {/* Stock */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Inventario / Stock
        </h2>
        <OpsStockSection
          items={stockItems.map((i) => ({
            id: i.id,
            categoryKey: i.categoryKey,
            name: i.name,
            restockThreshold: i.restockThreshold,
            locationNote: i.locationNote,
            unitLabel: i.unitLabel,
          }))}
          propertyId={propertyId}
        />
      </div>

      {/* Maintenance */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Mantenimiento
        </h2>
        <OpsMaintenanceSection
          tasks={maintenanceTasks.map((t) => ({
            id: t.id,
            taskType: t.taskType,
            title: t.title,
            cadenceKey: t.cadenceKey,
            nextDueAt: t.nextDueAt?.toISOString() ?? null,
            ownerNote: t.ownerNote,
          }))}
          propertyId={propertyId}
        />
      </div>
    </div>
  );
}
