import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { PrimaryCta } from "@/components/ui/primary-cta";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { STATUS_LABELS, STATUS_TONES, type PropertyStatus } from "@/lib/types";
import { DeletePropertyButton } from "./delete-property-button";
import { DeleteDraftButton } from "./delete-draft-button";
import { requireOperator } from "@/lib/auth/require-operator";

const STEP_PATHS = [
  "/properties/new/step-1",
  "/properties/new/step-2",
  "/properties/new/step-3",
  "/properties/new/step-4",
  "/properties/new/review",
];

function PropertyCard({ property }: { property: { id: string; propertyNickname: string; status: string; city: string | null; country: string | null; maxGuests: number | null; bedroomsCount: number | null; bathroomsCount: number | null } }) {
  return (
    <div className="relative rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5 transition-shadow hover:shadow-md">
      <a href={`/properties/${property.id}`} className="block">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
              {property.propertyNickname}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {[property.city, property.country].filter(Boolean).join(", ") ||
                "Sin ubicación"}
            </p>
          </div>
          <Badge
            label={STATUS_LABELS[property.status as PropertyStatus] ?? property.status}
            tone={STATUS_TONES[property.status as PropertyStatus] ?? "neutral"}
          />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-[var(--color-text-muted)]">
          {property.maxGuests != null && (
            <span>{property.maxGuests} huéspedes</span>
          )}
          {property.bedroomsCount != null && (
            <span>{property.bedroomsCount} dormitorios</span>
          )}
          {property.bathroomsCount != null && (
            <span>{property.bathroomsCount} baños</span>
          )}
        </div>
      </a>
      <div className="absolute bottom-3 right-3">
        <DeletePropertyButton propertyId={property.id} propertyName={property.propertyNickname} />
      </div>
    </div>
  );
}

function DraftWizardCard({ session }: { session: { id: string; propertyNickname: string | null; currentStep: number; updatedAt: Date } }) {
  const stepIndex = Math.min(session.currentStep - 1, STEP_PATHS.length - 1);
  const resumeHref = `${STEP_PATHS[stepIndex]}?sessionId=${session.id}`;

  return (
    <div className="relative rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-background-subtle)] p-5 transition-all hover:border-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-subtle)]">
      <a href={resumeHref} className="block">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
              {session.propertyNickname || "Sin nombre"}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {session.currentStep > 4 ? "Revisión" : `Paso ${session.currentStep} de 4`}
            </p>
          </div>
          <Badge label="Borrador" tone="warning" />
        </div>
        <p className="mt-3 text-xs font-medium text-[var(--color-action-primary-subtle-fg)]">
          Continuar configuración &rarr;
        </p>
      </a>
      <div className="absolute bottom-3 right-3">
        <DeleteDraftButton sessionId={session.id} sessionName={session.propertyNickname ?? "borrador"} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-border-default)] px-8 py-16 text-center">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Sin propiedades todavía
      </h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--color-text-muted)]">
        Crea tu primera propiedad para generar guías inteligentes, mensajes
        automáticos y mucho más.
      </p>
      <div className="mt-6">
        <PrimaryCta label="Crear propiedad" href="/properties/new/welcome" />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  try {
    await requireOperator();
  } catch {
    redirect("/login");
  }

  const [properties, draftSessions] = await Promise.all([
    prisma.property.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        propertyNickname: true,
        status: true,
        city: true,
        country: true,
        maxGuests: true,
        bedroomsCount: true,
        bathroomsCount: true,
      },
    }),
    prisma.wizardSession.findMany({
      where: { status: "in_progress", propertyId: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        propertyNickname: true,
        currentStep: true,
        updatedAt: true,
      },
    }),
  ]);

  const hasContent = properties.length > 0 || draftSessions.length > 0;

  return (
    <div className="min-h-screen bg-[var(--color-background-page)]">
      {/* Minimal header with toggle */}
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-background-page)] px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            Guide Builder
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Propiedades
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Gestiona tus alojamientos y sus guías
            </p>
          </div>
          {hasContent && (
            <PrimaryCta label="Crear propiedad" href="/properties/new/welcome" />
          )}
        </div>

        <div className="mt-8">
          {!hasContent ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {draftSessions.map((session) => (
                <DraftWizardCard key={session.id} session={session} />
              ))}
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
