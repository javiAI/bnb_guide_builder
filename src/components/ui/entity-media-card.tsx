"use client";

import { ChevronUp, CircleCheck, CircleDashed, CircleDot, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BadgeTone } from "@/lib/types";
import { TONE_PILL_TEXT } from "@/lib/tone";
import { Tooltip } from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────
// EntityMediaCard — shared "operator entity cockpit card" shell.
//
// Extracted from the Access cockpit (`subsystem-card.tsx`) so Access, Spaces
// and future media-backed operator surfaces share ONE card: same silhouette,
// icon-badge, status pill, expand/collapse behavior and View-Transitions morph.
//
// Two roles, parent-owned:
//   • idle   — collapsed <article>: media area (cover) on top + a single
//              body-expand <button> (icon-badge + title + status + content).
//   • active — expanded <div>: media area + header (collapse trigger +
//              optional action) + a <section> body holding `children`.
//
// Anatomy is faithful to the cockpit so the Access migration is behavior-
// preserving. Content differs per surface via slots:
//   media            — the <MediaCarousel> (parent picks variant + wires
//                      bodyId/onExpand/onLightboxOpen). Optional (Access
//                      parking renders its map in the body instead).
//   overlay          — sibling rendered right after the media (e.g. lightbox).
//   collapsedContent — idle body content (method tiles / space facts+progress).
//   srOnly           — idle screen-reader-only extras (media counts).
//   hoverOverlay     — idle absolute overlay (cover-upload affordance).
//   headerAction     — active header sibling next to the collapse trigger.
//   status           — idle header right (a <EntityCardStatusPill> or custom).
//
// View-Transitions: each card carries a unique inline `view-transition-name`
// + the `recipe-entity-card-vt` class (assigns `view-transition-class:
// entity-card`, tuned in recipes.css) so the morph works with dynamic ids.
// The two roles render different elements/classes; the browser morphs the
// snapshot between them. a11y ids (titleId/bodyId) are caller-owned so the
// media's `aria-controls={bodyId}` stays in sync with the body region.
// ─────────────────────────────────────────────────────────────────────────

export type EntityCardRole = "idle" | "active";

interface EntityMediaCardProps {
  role: EntityCardRole;
  /** Unique per card — drives the View-Transition morph (`view-transition-name`). */
  viewTransitionName: string;
  /** Optional id on the root (anchor / scroll target). */
  domId?: string;
  /** Caller-owned a11y ids (shared with the media's `aria-controls`). */
  titleId: string;
  bodyId: string;
  icon: LucideIcon;
  title: string;
  /** Active header subtitle. */
  subtitle?: ReactNode;
  /** Active-role editable title (e.g. <InlineEditText>). When set, the title is
   * interactive so collapse moves to a dedicated chevron (no button-in-button).
   * Omit for a static title that collapses on full-row click (Access). */
  titleNode?: ReactNode;
  /** Idle header right slot — typically <EntityCardStatusPill>. */
  status?: ReactNode;
  /** Cover area (MediaCarousel). Parent wires variant/bodyId/onExpand/lightbox. */
  media?: ReactNode;
  /** Sibling rendered right after the media (e.g. MediaLightbox portal host). */
  overlay?: ReactNode;
  /** Idle body content (tiles / facts + progress). Bottom-aligned in the card. */
  collapsedContent?: ReactNode;
  /** Idle screen-reader-only extras (counts). */
  srOnly?: ReactNode;
  /** Idle absolute overlay (cover-upload), sibling of the body button. */
  hoverOverlay?: ReactNode;
  /** Active header action next to the collapse trigger (cover-upload). */
  headerAction?: ReactNode;
  /** Active body. */
  children?: ReactNode;
  /** No-media entities (contacts, playbooks, places): drops the cover-driven
   * min-height so the idle card reads as a compact header card. Media-backed
   * cards (and siblings sharing a row with them, e.g. Access parking) keep
   * the default tall silhouette. */
  compact?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  className?: string;
}

// 40×40 accent icon-badge, baked so every entity card shares the mark.
function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-[var(--color-action-primary)] text-[var(--color-text-on-accent)]"
    >
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}

export function EntityMediaCard({
  role,
  viewTransitionName,
  domId,
  titleId,
  bodyId,
  icon,
  title,
  subtitle,
  titleNode,
  status,
  media,
  overlay,
  collapsedContent,
  srOnly,
  hoverOverlay,
  headerAction,
  children,
  compact = false,
  onExpand,
  onCollapse,
  className,
}: EntityMediaCardProps) {
  const cardStyle = { viewTransitionName } as React.CSSProperties;

  if (role === "active") {
    return (
      <div
        id={domId}
        style={cardStyle}
        className={cn(
          "recipe-entity-card-vt overflow-hidden rounded-[20px] border border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] shadow-[var(--elevation-surface-sm)]",
          className,
        )}
      >
        {media}
        {overlay}
        {/* Header. Two shapes, both avoiding button-in-button:
           • titleNode set → editable title (interactive); collapse on a chevron.
           • else → the whole title row is the collapse trigger (Access). */}
        {titleNode ? (
          <div className="flex items-center gap-3 p-5">
            <IconBadge icon={icon} />
            <span className="flex min-w-0 flex-col gap-1">
              <span id={titleId} className="min-w-0">{titleNode}</span>
              {subtitle && (
                <span className="text-[13px] leading-[1.45] text-[var(--color-text-secondary)]">
                  {subtitle}
                </span>
              )}
            </span>
            {/* Large click-to-collapse area filling the header (everything that
               isn't the editable title or the media action). Mouse convenience —
               keyboard/SR use the labeled chevron, so this is aria-hidden. */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={onCollapse}
              className="min-h-[44px] flex-1 cursor-pointer self-stretch rounded-[var(--radius-md)] transition-colors hover:bg-[var(--color-background-muted)]/40"
            ></button>
            {headerAction}
            <button
              type="button"
              aria-expanded={true}
              aria-controls={bodyId}
              aria-labelledby={titleId}
              onClick={onCollapse}
              aria-label="Contraer"
              className="recipe-icon-btn-32 grid h-8 w-8 flex-none place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
            >
              <ChevronUp size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={true}
              aria-controls={bodyId}
              aria-labelledby={titleId}
              onClick={onCollapse}
              className={cn(
                "group flex min-w-0 flex-1 items-center gap-3 p-5 text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
                "hover:bg-[var(--color-background-muted)]/40",
              )}
            >
              <IconBadge icon={icon} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  id={titleId}
                  className="truncate text-[16px] font-semibold leading-tight text-[var(--color-text-primary)]"
                >
                  {title}
                </span>
                {subtitle && (
                  <span className="text-[13px] leading-[1.45] text-[var(--color-text-secondary)]">
                    {subtitle}
                  </span>
                )}
              </span>
            </button>
            {headerAction}
          </div>
        )}
        <section
          id={bodyId}
          role="region"
          aria-labelledby={titleId}
          className="border-t border-[var(--color-border-default)] p-5"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </section>
      </div>
    );
  }

  // ── Collapsed (idle) ──
  // Two sibling expand affordances (media-area onExpand + body button) → no
  // nested interactive HTML. The body button bottom-aligns its content so
  // tiles/facts sit at the foot of the fixed-height card.
  return (
    <article
      id={domId}
      data-component="entity-media-card"
      aria-labelledby={titleId}
      style={cardStyle}
      className={cn(
        "recipe-entity-card-vt group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] text-left",
        !compact && "min-h-[260px]",
        "transition-[border-color,box-shadow] duration-200 ease-out",
        "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-action-primary)]",
        // `shadow-[var(--…)]` is mis-parsed by Tailwind v3 as a shadow color;
        // use the literal [box-shadow:…] form.
        "hover:[box-shadow:var(--elevation-surface-lg)]",
        "focus-within:[box-shadow:var(--elevation-surface-md)]",
        className,
      )}
    >
      {media}
      {overlay}
      <button
        type="button"
        aria-expanded={false}
        aria-controls={bodyId}
        aria-labelledby={titleId}
        onClick={onExpand}
        className={cn(
          "flex flex-1 flex-col gap-3 p-4 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]",
        )}
      >
        <span className="flex w-full items-center gap-3">
          <IconBadge icon={icon} />
          <span
            id={titleId}
            className="min-w-0 flex-1 line-clamp-2 text-[15px] font-semibold leading-tight text-[var(--color-text-primary)]"
          >
            {title}
          </span>
          {status}
        </span>

        {collapsedContent && (
          <span className="flex flex-1 flex-col items-start justify-end overflow-visible">
            {collapsedContent}
          </span>
        )}

        {srOnly && <span className="sr-only">{srOnly}</span>}
      </button>
      {hoverOverlay}
    </article>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────
// Shared across entity cards so Access (configured/pending) and Spaces
// (complete/partial/none) render an identical pill. Tone-keyed via tone.ts.

// Canonical status vocabulary for entity cards — ONE icon+tone per state,
// everywhere: check = done, dot = started, dashed = nothing yet. Surfaces map
// their domain states onto these three and provide only the label/detail copy.
// `entity-card-status.test.ts` pins the mapping and that pill consumers don't
// hand-pick circle icons.
export type EntityCardStatus = "complete" | "partial" | "empty";

export const ENTITY_CARD_STATUS_META: Record<
  EntityCardStatus,
  { tone: BadgeTone; icon: LucideIcon }
> = {
  complete: { tone: "success", icon: CircleCheck },
  partial: { tone: "warning", icon: CircleDot },
  empty: { tone: "neutral", icon: CircleDashed },
};

// Tone-keyed status indicator: a single cohesive circular Lucide glyph
// (CircleCheck / CircleDot / CircleDashed / Circle — passed by the caller) in
// the tone color, followed by the label. One glyph = perfectly centered, and
// the dedicated circular icons read as status at a glance. The label collapses
// to icon-only when the host grid is at 4 columns (narrow cards) via
// `recipe-card-status-label`; the styled <Tooltip> always surfaces the full
// label on hover (consistent app tooltip format, never the native gray/black
// `title=`). `aria-label` announces the status even when icon-only.
export function EntityCardStatusPill({
  status,
  label,
  detail,
}: {
  /** Canonical state — the pill resolves icon+tone from ENTITY_CARD_STATUS_META
   * itself, so consumers can't hand-pick circles (entity-card-status.test.ts). */
  status: EntityCardStatus;
  label: string;
  /** Optional hover explanation — e.g. what's still missing to be complete. */
  detail?: string;
}) {
  const { tone, icon: Icon } = ENTITY_CARD_STATUS_META[status];
  const tooltip = detail ? `${label} · ${detail}` : label;
  return (
    <Tooltip text={tooltip} className="flex-none">
      <span aria-label={tooltip} className="inline-flex flex-none items-center gap-1.5">
        <Icon size={20} strokeWidth={2} aria-hidden="true" className={cn("flex-none", TONE_PILL_TEXT[tone])} />
        <span
          className={cn(
            "recipe-card-status-label text-[11px] font-semibold uppercase tracking-[0.04em]",
            TONE_PILL_TEXT[tone],
          )}
        >
          {label}
        </span>
      </span>
    </Tooltip>
  );
}
