"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BadgeTone } from "@/lib/types";
import { TONE_PILL_BG, TONE_PILL_TEXT } from "@/lib/tone";

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
  status,
  media,
  overlay,
  collapsedContent,
  srOnly,
  hoverOverlay,
  headerAction,
  children,
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
        {/* Header: collapse trigger (flex-1) + optional action (sibling, never
           nested) so we never produce a button-inside-button. */}
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
        "recipe-entity-card-vt group relative flex min-h-[260px] w-full flex-col overflow-hidden rounded-[20px] text-left",
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
            title={title}
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

export function EntityCardStatusPill({
  tone,
  icon: Icon,
  label,
}: {
  tone: BadgeTone;
  icon?: LucideIcon;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex flex-none items-center gap-1 rounded-[8px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
        TONE_PILL_BG[tone],
        TONE_PILL_TEXT[tone],
      )}
    >
      {Icon && <Icon size={11} strokeWidth={2.5} aria-hidden="true" />}
      {label}
    </span>
  );
}
