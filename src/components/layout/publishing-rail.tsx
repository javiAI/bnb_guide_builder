import Link from "next/link";
import { Bot, Check, ExternalLink, Eye } from "lucide-react";
import { TextLink } from "@/components/ui/text-link";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { CopyLinkButton } from "./copy-link-button";
import { QrModalButton } from "./qr-modal-button";
import { RailResizeHandle } from "./shell-chrome";

interface PublishingRailProps {
  propertyId: string;
  /** Public guide handoff, resolved once in AppShell (parallel with other reads). */
  publicUrl: string | null;
  qrSvg: string | null;
  overallScore?: number;
  publishable?: boolean;
  defaultLocale: string;
}

/**
 * Companion rail (Liora 16F.5). Not a duplicate of the left-nav rings: it is the
 * "what now" panel. A compact publish-status (can I publish yet + link to the
 * hub), guide shortcuts (copy / open / enlarge-QR modal — no always-on QR
 * eating space), and the assistant docked at the bottom for quick queries. When
 * the rail is collapsed or the viewport is below xl, the assistant lives in a
 * floating bubble instead (see `AssistantLauncher`); the full chat + knowledge
 * page is `/ai`, reachable from the nav and the rail's "Conocimiento" link.
 */
export function PublishingRail({
  propertyId,
  publicUrl,
  qrSvg,
  overallScore,
  publishable,
  defaultLocale,
}: PublishingRailProps) {
  const overall = typeof overallScore === "number" ? overallScore : 0;
  const isPublished = Boolean(publicUrl);

  return (
    <aside
      aria-label="Panel de la propiedad"
      className="shell-rail hidden flex-col overflow-hidden border-l border-[var(--color-border-default)] bg-[var(--color-background-page)] xl:flex"
      style={{
        position: "sticky",
        top: "calc(var(--topbar-height) + 1px)",
        height: "calc(100vh - var(--topbar-height) - 1px)",
      }}
    >
      <RailResizeHandle />

      {/* ── Shortcuts (fixed top) ── */}
      <div className="shrink-0 space-y-5 border-b border-[var(--color-border-subtle)] px-5 py-4">
        {/* Publish status — "when can I publish", not a duplicate step list */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              Publicación
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]">
              {overall}%
            </span>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-background-muted)]">
            <span
              className="block h-full rounded-full bg-[var(--color-action-primary)] transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, overall))}%` }}
            />
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[12px] leading-[1.4]">
            {publishable ? (
              <>
                <Check
                  size={13}
                  strokeWidth={3}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-status-success-solid)]"
                />
                <span className="font-medium text-[var(--color-text-primary)]">
                  Lista para publicar
                </span>
              </>
            ) : (
              <span className="text-[var(--color-text-secondary)]">
                Completa las secciones clave para poder publicar la guía.
              </span>
            )}
          </p>
          <TextLink
            href={`/properties/${propertyId}/publishing`}
            size="sm"
            arrow
            className="mt-1.5 inline-block"
          >
            Ir a publicación
          </TextLink>
        </div>

        {/* Guide shortcuts — copy / open / enlarge QR, no always-on QR */}
        {isPublished && publicUrl ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              Guía pública
            </p>
            <div className="flex items-center gap-1.5">
              <CopyLinkButton url={publicUrl} variant="secondary" />
              <Link
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir guía en una nueva pestaña"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[var(--color-action-primary)] px-3 text-[12px] font-medium text-[var(--color-action-primary-fg)] no-underline transition-colors hover:bg-[var(--color-action-primary-hover)] hover:text-[var(--color-action-primary-fg)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Abrir
              </Link>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-1">
              {qrSvg && <QrModalButton url={publicUrl} qrSvg={qrSvg} />}
              <Link
                href={`/properties/${propertyId}/guest-guide`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[12px] font-medium text-[var(--color-text-muted)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline"
              >
                <Eye size={12} aria-hidden="true" />
                Vista huésped
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] px-3 py-3 text-center text-[12px] text-[var(--color-text-muted)]">
            <p className="mb-1.5">Sin publicar todavía.</p>
            <TextLink href={`/properties/${propertyId}/publishing`} size="sm" arrow>
              Publicar guía
            </TextLink>
          </div>
        )}
      </div>

      {/* ── Assistant docked (fills remaining height) ── */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-1 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            <Bot size={13} aria-hidden="true" />
            Asistente
          </span>
          <TextLink href={`/properties/${propertyId}/ai`} size="xs" arrow>
            Conocimiento
          </TextLink>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <AssistantChat
            propertyId={propertyId}
            defaultLocale={defaultLocale}
            fill
            autoResumeLast
          />
        </div>
      </div>
    </aside>
  );
}
