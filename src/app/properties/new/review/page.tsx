import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { findItem, propertyTypes, roomTypes, accessMethods, buildingAccessMethods, bedTypes, SPACE_TYPE_LABELS, getSpaceTypeLabel, LAYOUT_SPACE_MAP } from "@/lib/taxonomy-loader";
import { ReviewActions } from "./review-actions";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ sessionId?: string }>;
}

interface ReviewItem {
  label: string;
  value: string;
  multiline?: boolean;
  lines?: string[];
}

export default async function WizardReviewPage({ searchParams }: Props) {
  const { sessionId } = await searchParams;
  if (!sessionId) redirect("/properties/new/welcome");

  const session = await prisma.wizardSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) redirect("/properties/new/welcome");

  const state = (session.stateJson as Record<string, unknown>) ?? {};

  const ptId = state.propertyType as string | undefined;
  const rtId = state.roomType as string | undefined;
  const pt = ptId ? findItem(propertyTypes, ptId) : null;
  const rt = rtId ? findItem(roomTypes, rtId) : null;

  const ptLabel = ptId === "pt.other" ? (state.customPropertyTypeLabel as string) ?? "Personalizado" : pt?.label ?? "—";
  const rtLabel = rtId === "rt.other" ? (state.customRoomTypeLabel as string) ?? "Personalizado" : rt?.label ?? "—";

  // Access
  const buildingAccess = state.buildingAccess as { methods?: string[]; customLabel?: string } | undefined;
  const unitAccess = state.unitAccess as { methods?: string[]; customLabel?: string } | undefined;

  function resolveAccessLabels(methods: string[], customLabel: string | undefined, taxonomy: typeof accessMethods): string[] {
    return methods.map((id) => {
      if (id.endsWith(".other")) return customLabel ?? "Otro";
      return findItem(taxonomy, id)?.label ?? id;
    });
  }

  const buildingLabels = buildingAccess?.methods?.length
    ? resolveAccessLabels(buildingAccess.methods, buildingAccess.customLabel, buildingAccessMethods)
    : [];
  const unitLabels = unitAccess?.methods?.length
    ? resolveAccessLabels(unitAccess.methods, unitAccess.customLabel, accessMethods)
    : [];

  const maxGuests = state.maxGuests as number | undefined;
  const beds = (state.beds as Array<{ spaceIndex: number; spaceType?: string; spaceLabel?: string; bedType: string; quantity: number }>) ?? [];
  const bedroomsCount = (state.bedroomsCount as number) ?? 0;

  const checkInEnd = state.checkInEnd as string | undefined;
  const checkInEndLabel = checkInEnd === "flexible" ? "Flexible" : checkInEnd ?? "—";

  // Build bed lines

  const bedLines: string[] = [];
  if (beds.length > 0) {
    const grouped = new Map<number, typeof beds>();
    for (const b of beds) {
      const arr = grouped.get(b.spaceIndex) ?? [];
      arr.push(b);
      grouped.set(b.spaceIndex, arr);
    }
    for (const [idx, spaceBeds] of grouped) {
      const first = spaceBeds[0];
      const st = first.spaceType ?? "sp.bedroom";
      const prefix = st === "sp.bedroom" ? `Dormitorio ${idx + 1}` : (SPACE_TYPE_LABELS[st] ?? "Zona");
      const desc = spaceBeds.map((b) => {
        const bt = findItem(bedTypes, b.bedType);
        return `${b.quantity}× ${bt?.label ?? b.bedType}`;
      }).join(", ");
      bedLines.push(`${prefix}: ${desc}`);
    }
  }

  const sections: Array<{
    title: string;
    items: ReviewItem[];
    complete: boolean;
    editHref: string;
  }> = [
    {
      title: "Tipo de alojamiento",
      items: [
        { label: "Tipo de propiedad", value: ptLabel },
        { label: "Tipo de espacio", value: rtLabel },
      ],
      complete: !!ptId && !!rtId,
      editHref: `/properties/new/step-1?sessionId=${sessionId}`,
    },
    {
      title: "Ubicación",
      items: [
        { label: "País", value: (state.country as string) ?? "—" },
        { label: "Ciudad", value: (state.city as string) ?? "—" },
        { label: "Zona horaria", value: (state.timezone as string) ?? "—" },
        ...((state.streetAddress as string) ? [{ label: "Dirección", value: state.streetAddress as string }] : []),
      ],
      complete: !!(state.country) && !!(state.city) && !!(state.timezone),
      editHref: `/properties/new/step-2?sessionId=${sessionId}`,
    },
    {
      title: "Capacidad y estructura",
      items: [
        { label: "Máx. huéspedes", value: maxGuests != null ? String(maxGuests) : "—" },
        { label: "Máx. adultos", value: (state.maxAdults as number) != null ? String(state.maxAdults) : "—" },
        { label: "Máx. niños", value: (state.maxChildren as number) != null ? String(state.maxChildren) : "—" },
        { label: "Bebés", value: (state.infantsAllowed as boolean) ? "Sí (cuna)" : "No" },
        { label: "Dormitorios", value: bedroomsCount != null ? String(bedroomsCount) : "—" },
        { label: "Baños", value: (state.bathroomsCount as number) != null ? String(state.bathroomsCount) : "—" },
        ...(bedLines.length > 0 ? [{
          label: "Camas",
          value: bedLines.join("\n"),
          multiline: true,
          lines: bedLines,
        }] : []),
      ],
      complete: maxGuests != null && (state.bathroomsCount as number) != null,
      editHref: `/properties/new/step-3?sessionId=${sessionId}`,
    },
    {
      title: "Acceso y check-in",
      items: [
        { label: "Autónomo", value: (state.isAutonomousCheckin as boolean) ? "Sí" : "No" },
        { label: "Check-in", value: state.checkInStart ? `${state.checkInStart} — ${checkInEndLabel}` : "—" },
        { label: "Check-out", value: (state.checkOutTime as string) ?? "—" },
        ...(buildingLabels.length > 0 ? [{
          label: "Acceso edificio",
          value: buildingLabels.join("\n"),
          multiline: true,
          lines: buildingLabels,
        }] : []),
        {
          label: "Acceso vivienda",
          value: unitLabels.length > 0 ? unitLabels.join("\n") : "—",
          multiline: unitLabels.length > 1,
          lines: unitLabels.length > 1 ? unitLabels : undefined,
        },
        ...((state.hostName as string) ? [{ label: "Anfitrión", value: `${state.hostName}${(state.hostContactPhone as string) ? ` · ${state.hostContactPhone}` : ""}` }] : []),
        ...((state.wifiSsid as string) ? [{ label: "WiFi", value: `${state.wifiSsid as string}${(state.wifiPassword as string) ? ` / ${state.wifiPassword as string}` : ""}` }] : []),
      ],
      complete: !!(state.checkInStart) && !!(state.checkOutTime) && (unitAccess?.methods?.length ?? 0) > 0,
      editHref: `/properties/new/step-4?sessionId=${sessionId}`,
    },
  ];

  // Pre-populated spaces preview
  const layoutKey = state.layoutKey as string | undefined;
  const bathroomsCount = (state.bathroomsCount as number) ?? 0;
  const prePopulatedSpaces: string[] = [];

  // Spaces from wizard beds — mirrors completeWizardAction grouping logic
  if (beds.length > 0) {
    const spaceMap = new Map<number, typeof beds>();
    for (const b of beds) {
      const arr = spaceMap.get(b.spaceIndex) ?? [];
      arr.push(b);
      spaceMap.set(b.spaceIndex, arr);
    }
    for (const [spaceIdx, spaceBeds] of spaceMap) {
      const first = spaceBeds[0];
      const spaceType = first.spaceType ?? "sp.bedroom";
      const isBedroom = spaceType === "sp.bedroom";
      prePopulatedSpaces.push(isBedroom ? `Dormitorio ${spaceIdx + 1}` : (first.spaceLabel ?? getSpaceTypeLabel(spaceType)));
    }
  } else if (bedroomsCount > 0) {
    for (let i = 0; i < bedroomsCount; i++) {
      prePopulatedSpaces.push(`Dormitorio ${i + 1}`);
    }
  }

  // Living/studio space from layoutKey
  const layoutSpaceType = layoutKey ? LAYOUT_SPACE_MAP[layoutKey] : undefined;
  if (layoutSpaceType) prePopulatedSpaces.push(getSpaceTypeLabel(layoutSpaceType));

  // Bathrooms
  for (let i = 0; i < bathroomsCount; i++) {
    prePopulatedSpaces.push(bathroomsCount === 1 ? "Baño" : `Baño ${i + 1}`);
  }

  const allComplete = sections.every((s) => s.complete);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Revisión</h1>
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            Revisa los datos de <strong>{session.propertyNickname}</strong> antes de crear la propiedad.
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)]"
        >
          Guardar y salir
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {section.title}
              </h2>
              <div className="flex items-center gap-3">
                <Badge
                  label={section.complete ? "Completo" : "Pendiente"}
                  tone={section.complete ? "success" : "warning"}
                />
                <a
                  href={section.editHref}
                  className="text-xs font-medium text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
                >
                  Editar
                </a>
              </div>
            </div>
            <dl className="mt-3 space-y-2">
              {section.items.map((item) => (
                <div key={item.label} className="flex gap-4">
                  <dt className="w-28 shrink-0 text-xs text-[var(--color-neutral-500)] pt-0.5">{item.label}</dt>
                  <dd className="text-sm text-[var(--foreground)]">
                    {item.multiline && item.lines ? (
                      <ul className="space-y-0.5">
                        {item.lines.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {prePopulatedSpaces.length > 0 && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Espacios que se crearán</h2>
          <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
            Al completar el wizard se crearán automáticamente estos espacios con los datos ya configurados.
          </p>
          <ul className="mt-3 space-y-1">
            {prePopulatedSpaces.map((name, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-400)]" />
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ReviewActions sessionId={sessionId} allComplete={allComplete} />

      <div className="mt-6">
        <Link
          href={`/properties/new/step-4?sessionId=${sessionId}`}
          className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
        >
          &larr; Volver
        </Link>
      </div>
    </div>
  );
}
