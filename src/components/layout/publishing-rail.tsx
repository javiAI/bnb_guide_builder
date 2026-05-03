import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import {
  Check,
  Eye,
  Brain,
  Wand2,
  History,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { CopyLinkButton } from "./copy-link-button";
import { QrModalButton } from "./qr-modal-button";

interface PublishingRailProps {
  propertyId: string;
  publicSlug: string | null;
  sectionScores?: Record<string, number>;
  overallScore?: number;
}

interface RailStep {
  key: string;
  label: string;
  href: string;
  percent: number;
}

const RAIL_STEP_DEFS: ReadonlyArray<{ key: string; label: string; pathSegment: string }> = [
  { key: "access", label: "Acceso y llegada", pathSegment: "access" },
  { key: "spaces", label: "Espacios", pathSegment: "spaces" },
  { key: "amenities", label: "Equipamiento", pathSegment: "amenities" },
  { key: "systems", label: "Sistemas", pathSegment: "systems" },
];

const SHORTCUTS: ReadonlyArray<{ icon: LucideIcon; label: string; pathSegment: string }> = [
  { icon: Eye, label: "Vista huésped", pathSegment: "guest-guide" },
  { icon: Brain, label: "Probar asistente", pathSegment: "ai" },
  { icon: Wand2, label: "Sugerencias IA", pathSegment: "knowledge" },
  { icon: History, label: "Historial", pathSegment: "activity" },
];

function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, width: 240 });
}

function buildSteps(propertyId: string, scores?: Record<string, number>): RailStep[] {
  return RAIL_STEP_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    href: `/properties/${propertyId}/${d.pathSegment}`,
    percent: scores?.[d.key] ?? 0,
  }));
}

export async function PublishingRail({
  propertyId,
  publicSlug,
  sectionScores,
  overallScore,
}: PublishingRailProps) {
  const steps = buildSteps(propertyId, sectionScores);
  const overall = typeof overallScore === "number" ? overallScore : 0;

  const firstIncompleteIdx = steps.findIndex((s) => s.percent < 100);

  let publicUrl: string | null = null;
  let qrSvg: string | null = null;
  if (publicSlug) {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const proto = headersList.get("x-forwarded-proto") ?? "http";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`;
    publicUrl = `${baseUrl}/g/${publicSlug}`;
    try {
      qrSvg = await generateQrSvg(publicUrl);
    } catch (err) {
      console.error("[publishing-rail] QR generation failed", err);
      qrSvg = null;
    }
  }

  return (
    <aside
      aria-label="Ruta de publicación"
      className="hidden border-l border-[var(--color-border-default)] bg-[var(--color-background-page)] xl:block"
      style={{
        position: "sticky",
        top: "calc(var(--topbar-height) + 1px)",
        height: "calc(100vh - var(--topbar-height) - 1px)",
        overflowY: "auto",
        padding: "20px 24px",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          Ruta de publicación
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]">
          {overall}%
        </span>
      </div>
      <div className="mb-5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-background-muted)]">
        <span
          className="block h-full rounded-full bg-[var(--color-action-primary)] transition-[width]"
          style={{ width: `${Math.max(0, Math.min(100, overall))}%` }}
        />
      </div>

      <ul className="mb-5 flex flex-col gap-0.5">
        {steps.map((step, idx) => {
          const done = step.percent >= 100;
          const current = !done && idx === firstIncompleteIdx;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-2 py-1.5 transition-colors hover:bg-[var(--color-interactive-hover)]"
              >
                <span
                  className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border ${
                    done
                      ? "border-[var(--color-status-success-solid)] bg-[var(--color-status-success-solid)]"
                      : current
                        ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)]"
                        : "border-[var(--color-border-default)]"
                  }`}
                  aria-hidden="true"
                >
                  {done && (
                    <Check
                      size={11}
                      strokeWidth={3}
                      className="text-[var(--color-status-success-solid-fg)]"
                    />
                  )}
                  {current && (
                    <span className="h-[5px] w-[5px] rounded-full bg-[var(--color-action-primary)]" />
                  )}
                </span>
                <span
                  className={`flex-1 text-[13px] ${
                    current
                      ? "font-medium text-[var(--color-text-primary)]"
                      : done
                        ? "text-[var(--color-text-muted)]"
                        : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                  {step.percent}%
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="my-5 h-px bg-[var(--color-border-subtle)]" />

      <div className="mb-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          Atajos
        </p>
        <ul className="flex flex-col">
          {SHORTCUTS.map(({ icon: Icon, label, pathSegment }) => (
            <li key={pathSegment}>
              <Link
                href={`/properties/${propertyId}/${pathSegment}`}
                className="flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-2 py-2 text-[13px] text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline"
              >
                <Icon size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />
                <span className="flex-1">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          Guía pública
        </p>
        {publicSlug && publicUrl ? (
          <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-3">
            {qrSvg && (
              <div className="mb-3 flex justify-center">
                <div
                  role="img"
                  aria-label="Código QR de la guía"
                  className="rounded-[8px] bg-white p-2 [&>svg]:block [&>svg]:h-[136px] [&>svg]:w-[136px]"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              </div>
            )}
            <p
              className="mb-3 break-all rounded-[8px] bg-[var(--color-background-page)] px-2.5 py-2 font-mono text-[11.5px] leading-[1.4] text-[var(--color-text-secondary)]"
              title={publicUrl}
            >
              <span className="text-[var(--color-text-muted)]">
                {publicUrl.replace(/^https?:\/\//, "").replace(/\/[^/]+$/, "/")}
              </span>
              <span className="text-[var(--color-text-primary)]">
                {publicSlug}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <CopyLinkButton url={publicUrl} variant="secondary" />
              <Link
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir guía en una nueva pestaña"
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[var(--color-action-primary)] px-3 text-[12px] font-medium text-[var(--color-action-primary-fg)] no-underline transition-colors hover:bg-[var(--color-action-primary-hover)] hover:text-[var(--color-action-primary-fg)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Abrir guía
              </Link>
            </div>
            {qrSvg && (
              <div className="mt-2 flex justify-center">
                <QrModalButton url={publicUrl} qrSvg={qrSvg} />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] px-3 py-4 text-center text-[12px] text-[var(--color-text-muted)]">
            <p className="mb-2">Sin publicar todavía.</p>
            <Link
              href={`/properties/${propertyId}/publishing`}
              className="font-medium text-[var(--color-text-link)] hover:underline"
            >
              Publicar guía →
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
