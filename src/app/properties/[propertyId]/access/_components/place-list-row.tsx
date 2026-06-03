"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Globe, Loader2, MapPin, type LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/services/places";

/** Normalizes a provider address for display in the suggestion/confirmed row
 * subtitle. MapTiler returns `"<name>, <street>, <postcode> <city>, <country>"`
 * where `<name>` is the literal "-" placeholder when the POI has no name. We
 * keep only the street-level segment(s) — postcode/city/country bloat the row
 * with redundant info the operator already knows (it's their own property's
 * locality). Returns `null` when nothing meaningful remains. */
export function formatDisplayAddress(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "-");
  if (segments.length === 0) return null;
  if (
    segments.length > 1 &&
    /^[\p{L}\s.'-]{1,30}$/u.test(segments[segments.length - 1]!)
  ) {
    segments.pop();
  }
  const filtered = segments.filter((s) => !/^\d{4,5}(\s|$)/.test(s));
  return filtered.length > 0 ? filtered.join(", ") : null;
}

/** Shared row primitive for the Añadidos + Sugeridos columns across parking
 * and arrival modes. Composes: caller-provided leading slot (fee badge for
 * parking; per-mode hue circle for transit) · inline-editable name with
 * SquarePen affordance (italic placeholder when blank) · distance pin chip
 * · optional address + website · optional extraAction (Move for parking
 * relocate) · required trailing action (Plus on suggestions, Trash2 on
 * confirmed). `isActive` is the persistent highlight when the matching map
 * pin is selected. */
export function PlaceListRow({
  leadingSlot,
  name,
  placeholderName,
  address,
  website,
  distanceMeters,
  onRename,
  extraAction,
  trailingAction,
  onActivate,
  onDeactivate,
  isActive,
  disabled,
}: {
  leadingSlot: ReactNode;
  name: string;
  /** Placeholder shown in italic when `name` is blank or `"-"`. Defaults to
   * "Añadir nombre" — kept as a prop so the (rare) callers that need a
   * domain-specific label can override it without forking the primitive. */
  placeholderName?: string;
  address: string | null;
  website?: string | null;
  distanceMeters: number | null;
  /** When omitted, the name is read-only (no SquarePen, no edit-on-click). */
  onRename?: (name: string) => void;
  extraAction?: {
    icon: LucideIcon;
    label: string;
    onAction: () => void;
    tone: "neutral" | "warning";
  };
  trailingAction: {
    icon: LucideIcon;
    label: string;
    tone: "primary" | "danger";
    onAction: () => void;
    /** Renders a spinner inside the trailing button when true. Used by transit
     * Add to surface the bulk-confirm round-trip latency. */
    pending?: boolean;
    /** Disables the trailing button independently from the row-level `disabled`
     * flag. Used by the draft-pin Confirm to grey out the button while the
     * draft has no name (the rest of the row stays interactive so the operator
     * can type a name). */
    disabled?: boolean;
  };
  onActivate?: () => void;
  onDeactivate?: () => void;
  isActive?: boolean;
  disabled: boolean;
}) {
  const TrailingIcon = trailingAction.icon;
  const trimmedName = name.trim();
  const hasRealName = trimmedName !== "" && trimmedName !== "-";
  const displayName = hasRealName ? trimmedName : null;
  const placeholder = placeholderName ?? "Añadir nombre";
  const rowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  const distance = distanceMeters !== null ? formatDistance(distanceMeters) : null;
  const displayAddress = formatDisplayAddress(address);
  const editable = Boolean(onRename);

  return (
    <li
      ref={rowRef}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className={cn(
        "group flex items-center gap-2 rounded-[8px] border px-1.5 py-1.5",
        isActive
          ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)]"
          : "border-transparent hover:border-[var(--color-border-default)] hover:bg-[var(--color-background-subtle)] focus-within:border-[var(--color-border-default)] focus-within:bg-[var(--color-background-subtle)]",
      )}
    >
      {leadingSlot}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {editable ? (
            <InlineEditText
              value={name}
              onCommit={(next) => onRename?.(next)}
              placeholder={placeholder}
              ariaLabel="Nombre"
              textClassName="text-[13px] font-medium"
              disabled={disabled}
              revealOnHover
              withTooltip
              iconSize={12}
            />
          ) : (
            <Tooltip text={displayName ?? placeholder} className="min-w-0 shrink">
              <span
                className={cn(
                  "min-w-0 max-w-full truncate text-[13px] font-medium",
                  displayName
                    ? "text-[var(--color-text-primary)]"
                    : "italic text-[var(--color-text-subtle)]",
                )}
              >
                {displayName ?? placeholder}
              </span>
            </Tooltip>
          )}
        </div>
        {(displayAddress || website) && (
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
            {displayAddress && (
              <Tooltip text={displayAddress} className="min-w-0 flex-1">
                <span className="min-w-0 flex-1 truncate">{displayAddress}</span>
              </Tooltip>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-none items-center gap-0.5 text-[var(--color-text-link)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Globe size={11} aria-hidden="true" />
                Web
              </a>
            )}
          </div>
        )}
      </div>

      {distance && (
        <span
          className={cn(
            "flex flex-none items-center gap-0.5 rounded-[6px] px-1.5 py-0.5",
            "bg-[var(--color-background-subtle)] text-[11px] font-medium text-[var(--color-text-primary)]",
            "tabular-nums",
          )}
          aria-label={`Distancia ${distance}`}
        >
          <MapPin size={11} aria-hidden="true" />
          {distance}
        </span>
      )}

      {extraAction && (
        <Tooltip text={extraAction.label}>
          <button
            type="button"
            onClick={extraAction.onAction}
            disabled={disabled}
            aria-label={extraAction.label}
            className={cn(
              "recipe-icon-btn-32 flex h-8 w-8 flex-none items-center justify-center rounded-[6px] transition-colors duration-100",
              extraAction.tone === "warning"
                ? "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)] hover:bg-[var(--color-status-warning-bg)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-secondary)]",
              "disabled:cursor-not-allowed disabled:opacity-30",
            )}
          >
            <extraAction.icon size={14} aria-hidden="true" />
          </button>
        </Tooltip>
      )}

      <Tooltip text={trailingAction.label}>
        <button
          type="button"
          onClick={trailingAction.onAction}
          disabled={
            disabled || trailingAction.pending || trailingAction.disabled
          }
          aria-label={trailingAction.label}
          className={cn(
            "recipe-icon-btn-32 flex h-8 w-8 flex-none items-center justify-center rounded-[6px] transition-colors duration-100",
            trailingAction.tone === "primary"
              ? "text-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-subtle)]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-status-error-bg)] hover:text-[var(--color-status-error-text)]",
            "disabled:cursor-not-allowed disabled:opacity-30",
          )}
        >
          {trailingAction.pending ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <TrailingIcon size={14} aria-hidden="true" />
          )}
        </button>
      </Tooltip>
    </li>
  );
}
