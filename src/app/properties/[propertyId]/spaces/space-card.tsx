"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, ChevronDown, Move, Pencil, UsersRound, X, type LucideIcon } from "lucide-react";
import {
  renameSpaceAction,
  updateSpaceDetailsAction,
  archiveSpaceAction,
} from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { spaceTypes, getSpaceTypeItem } from "@/lib/taxonomies/space-types";
import { bedTypes } from "@/lib/taxonomies/bed-types";
import { getSpaceFeatureGroups } from "@/lib/taxonomies/space-features";
import { findItem } from "@/lib/taxonomies/_helpers";
import type { SpaceFeatureGroup, SpaceFeatureField } from "@/lib/types/taxonomy";
import { getSpaceIcon } from "@/lib/icons/space-icons";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { BedManager, type BedData } from "./bed-manager";
import { EntityGallery } from "@/components/media/entity-gallery";
import {
  computeProgressDot,
  PROGRESS_PERCENT,
  type FeatureState,
  type FeatureValue,
  type SpaceProgressLevel,
} from "./space-progress";

export type SpaceStatus = "active" | "archived";

interface SpaceData {
  id: string;
  spaceType: string;
  name: string;
  guestNotes: string | null;
  internalNotes: string | null;
  featuresJson: Record<string, unknown> | null;
  status: SpaceStatus;
}

interface SpaceSystem {
  id: string;
  systemKey: string;
  label: string;
}

interface SpaceCardProps {
  propertyId: string;
  maxGuests: number | null;
  space: SpaceData;
  beds: BedData[];
  spaceSystems?: SpaceSystem[];
  /** Signed URL of the first space image; null → gradient placeholder. */
  coverThumbUrl?: string | null;
  /** Total images assigned to the space (cover badge); 0 → no badge. */
  photoCount?: number;
}

const inputCls =
  "block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-focus)] focus:outline-none";

const PROGRESS_META: Record<
  SpaceProgressLevel,
  { label: string; bar: string; pill: string; icon: LucideIcon | null }
> = {
  complete: {
    label: "Ficha completa",
    bar: "bg-[var(--color-status-success-solid)]",
    pill: "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]",
    icon: Check,
  },
  partial: {
    label: "En progreso",
    bar: "bg-[var(--color-status-warning-solid)]",
    pill: "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]",
    icon: Pencil,
  },
  none: {
    label: "Sin datos",
    bar: "bg-[var(--color-border-strong)]",
    pill: "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-text)]",
    icon: null,
  },
};

export function SpaceCard({
  propertyId,
  maxGuests,
  space,
  beds,
  spaceSystems = [],
  coverThumbUrl = null,
  photoCount = 0,
}: SpaceCardProps) {
  const titleId = useId();

  // ── Expand / collapse (editor body) ──
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(0);
  const [bodyVisible, setBodyVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let expandTimer: ReturnType<typeof setTimeout> | undefined;
    let collapseTimer: ReturnType<typeof setTimeout> | undefined;
    let rafId: number | undefined;

    if (expanded) {
      setBodyVisible(true);
      rafId = requestAnimationFrame(() => {
        if (bodyRef.current) {
          setHeight(bodyRef.current.scrollHeight);
          expandTimer = setTimeout(() => setHeight("auto"), 300);
        }
      });
    } else {
      if (bodyRef.current) {
        setHeight(bodyRef.current.scrollHeight);
        rafId = requestAnimationFrame(() => setHeight(0));
      }
      collapseTimer = setTimeout(() => setBodyVisible(false), 300);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(expandTimer);
      clearTimeout(collapseTimer);
    };
  }, [expanded]);

  // ── Inline name editing ──
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(space.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [renameState, renameAction, renamePending] = useActionState<ActionResult | null, FormData>(
    renameSpaceAction,
    null,
  );

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (renameState?.success) {
      setNameValue((current) => current.trim());
      setEditingName(false);
    }
  }, [renameState]);

  // ── Feature state ──
  const [features, setFeatures] = useState<FeatureState>(
    (space.featuresJson as FeatureState) ?? {},
  );
  const [featuresDirty, setFeaturesDirty] = useState(false);

  function setFeature(fieldId: string, value: FeatureValue) {
    setFeatures((prev) => ({ ...prev, [fieldId]: value }));
    setFeaturesDirty(true);
  }

  // ── Feature groups ──
  const featureGroups = useMemo(() => getSpaceFeatureGroups(space.spaceType), [space.spaceType]);

  // ── Progress ──
  const hasBeds = (getSpaceTypeItem(space.spaceType)?.allowsSleeping ?? false) || beds.length > 0;
  const progressLevel = useMemo(
    () => computeProgressDot(features, featureGroups, hasBeds, beds.length),
    [features, featureGroups, hasBeds, beds.length],
  );
  const featuresJson = useMemo(() => JSON.stringify(features), [features]);

  // ── Details save form ──
  const [detailsState, detailsAction, detailsPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateSpaceDetailsAction, null);

  useEffect(() => {
    if (detailsState?.success) {
      setFeaturesDirty(false);
      setNotesDirty(false);
    }
  }, [detailsState]);

  const [notesDirty, setNotesDirty] = useState(false);
  const [showInternalNotes, setShowInternalNotes] = useState(Boolean(space.internalNotes));
  const formDirty = featuresDirty || notesDirty;

  const saveStatus = detailsPending
    ? "saving"
    : detailsState?.success
      ? "saved"
      : detailsState?.error
        ? "error"
        : undefined;

  // ── Archive / Restore ──
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveState, archiveAction, archivePending] = useActionState<ActionResult | null, FormData>(
    archiveSpaceAction,
    null,
  );
  const isArchived = space.status === "archived";

  // ── Derived ──
  const typeInfo = findItem(spaceTypes, space.spaceType);
  const TypeIcon = getSpaceIcon(space.spaceType);
  const adultCapacity = beds.reduce((sum, bed) => {
    if (bed.bedType === "bt.other") {
      const customCap = (bed.configJson?.customCapacity as number | undefined) ?? 1;
      return sum + customCap * bed.quantity;
    }
    const bt = findItem(bedTypes, bed.bedType);
    return sum + (bt?.sleepingCapacity ?? 1) * bed.quantity;
  }, 0);
  const cribCount = beds
    .filter((b) => b.bedType === "bt.crib")
    .reduce((sum, b) => sum + b.quantity, 0);

  let capacityLabel = "";
  if (adultCapacity > 0 || cribCount > 0) {
    const parts: string[] = [];
    if (adultCapacity > 0) parts.push(`${adultCapacity} pers.`);
    if (cribCount > 0) parts.push(`+ ${cribCount} ${cribCount === 1 ? "cuna" : "cunas"}`);
    capacityLabel = parts.join(" ");
  }

  const areaSqm = features["sf.area_sqm"];
  const areaLabel = typeof areaSqm === "number" && areaSqm > 0 ? `${areaSqm} m²` : null;

  const progress = PROGRESS_META[progressLevel];
  const StatusIcon = progress.icon;
  const percent = PROGRESS_PERCENT[progressLevel];

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border transition-colors duration-200",
        expanded && "col-span-full",
        isArchived
          ? "border-dashed border-[var(--color-border-default)] bg-[var(--color-background-muted)] opacity-80"
          : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-strong)]",
      )}
    >
      {/* ── Cover ── */}
      <div className="relative h-32 w-full overflow-hidden bg-[var(--color-background-muted)]">
        {coverThumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverThumbUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,var(--color-action-primary-subtle),var(--color-background-muted))]">
            <TypeIcon
              size={30}
              aria-hidden="true"
              className="text-[var(--color-action-primary)] opacity-70"
            />
          </div>
        )}
        {photoCount > 0 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-background-overlay)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-on-overlay)]">
            <Camera size={11} aria-hidden="true" />
            {photoCount}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-4">
        {editingName ? (
          <form action={renameAction} className="flex items-center gap-2">
            <input type="hidden" name="spaceId" value={space.id} />
            <input
              ref={nameInputRef}
              type="text"
              name="name"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setNameValue(space.name);
                  setEditingName(false);
                }
              }}
              className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-focus)] bg-[var(--color-background-surface)] px-2 py-1.5 text-sm font-semibold text-[var(--color-text-primary)] focus:outline-none"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={renamePending || !nameValue.trim()}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-3 text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
              aria-label="Guardar nuevo nombre del espacio"
            >
              <Check size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setNameValue(space.name);
                setEditingName(false);
              }}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)]"
              aria-label="Cancelar renombrado"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="-mx-1 flex min-h-[44px] min-w-0 flex-1 items-center rounded-[var(--radius-md)] px-1 text-left transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
              aria-expanded={expanded}
            >
              <span
                id={titleId}
                className="block truncate text-[15px] font-semibold text-[var(--color-text-primary)]"
              >
                {nameValue}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="recipe-icon-btn-32 grid h-8 w-8 flex-shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-secondary)]"
              aria-label="Renombrar espacio"
            >
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="recipe-icon-btn-32 grid h-8 w-8 flex-shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-secondary)]"
              aria-label={expanded ? "Colapsar espacio" : "Expandir espacio"}
              aria-expanded={expanded}
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={cn("transition-transform duration-200", expanded && "rotate-180")}
              />
            </button>
          </div>
        )}

        {/* ── Facts ── */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <TypeIcon size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
            {typeInfo?.label ?? space.spaceType}
          </span>
          {areaLabel && (
            <span className="inline-flex items-center gap-1">
              <Move size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
              {areaLabel}
            </span>
          )}
          {capacityLabel && (
            <span className="inline-flex items-center gap-1">
              <UsersRound size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
              {capacityLabel}
            </span>
          )}
        </div>

        {/* ── Foot: progress + status pill ── */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-medium text-[var(--color-text-secondary)]">
            <span className="h-[3px] max-w-[110px] flex-1 overflow-hidden rounded-full bg-[var(--color-progress-track)]">
              <span
                className={cn("block h-full rounded-full", progress.bar)}
                style={{ width: `${percent}%` }}
              />
            </span>
            {percent}%
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              progress.pill,
            )}
          >
            {StatusIcon && <StatusIcon size={11} aria-hidden="true" />}
            {progress.label}
          </span>
        </div>
      </div>

      {/* ── Collapsible editor body ── */}
      <div
        ref={bodyRef}
        style={{ maxHeight: height === "auto" ? "none" : `${height}px` }}
        className="overflow-hidden transition-all duration-300 ease-in-out"
      >
        {bodyVisible && (
          <div className="space-y-1 border-t border-[var(--color-border-default)] px-4 pb-6 pt-4">
            {/* Dimensions */}
            <SpaceSection label="Dimensiones">
              {(() => {
                const dimGroup = featureGroups.find((g) => g.id === "sfg.dimensions");
                if (!dimGroup) return null;
                return (
                  <FlatFeatureSection
                    group={dimGroup}
                    features={features}
                    onChangeFeature={setFeature}
                    noBorder
                  />
                );
              })()}
            </SpaceSection>

            {/* Beds */}
            {hasBeds && (
              <SpaceSection label="Camas">
                <BedManager propertyId={propertyId} spaceId={space.id} beds={beds} maxGuests={maxGuests} />
              </SpaceSection>
            )}

            {/* All remaining feature groups except dimensions */}
            <form id={`details-${space.id}`} action={detailsAction}>
              <input type="hidden" name="spaceId" value={space.id} />
              <input type="hidden" name="propertyId" value={propertyId} />
              <input type="hidden" name="featuresJson" value={featuresJson} />

              {featureGroups
                .filter((g) => g.id !== "sfg.dimensions")
                .map((group) => (
                  <SpaceSection key={group.id} label={group.label}>
                    <FlatFeatureSection
                      group={group}
                      features={features}
                      onChangeFeature={setFeature}
                      noBorder
                    />
                  </SpaceSection>
                ))}

              {/* Custom "Otros" field */}
              {featureGroups.length > 0 && (
                <SpaceSection label="Otros detalles">
                  <textarea
                    rows={2}
                    value={(features["sf.custom"] as string) ?? ""}
                    onChange={(e) => setFeature("sf.custom", e.target.value || null)}
                    placeholder="Cualquier detalle relevante que no encaje en las secciones anteriores…"
                    className={inputCls}
                  />
                </SpaceSection>
              )}

              {/* Notes */}
              <SpaceSection label="Notas para el huésped">
                <textarea
                  name="guestNotes"
                  rows={2}
                  defaultValue={space.guestNotes ?? ""}
                  placeholder="Información útil sobre este espacio visible en la guía del huésped…"
                  onChange={() => setNotesDirty(true)}
                  className={inputCls}
                />
              </SpaceSection>

              {/* Internal notes — toggle */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => setShowInternalNotes((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={cn("-rotate-90 transition-transform duration-150", showInternalNotes && "rotate-0")}
                  />
                  Notas internas
                  {space.internalNotes && (
                    <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
                  )}
                </button>
                {showInternalNotes && (
                  <div className="mt-2">
                    <textarea
                      name="internalNotes"
                      rows={2}
                      defaultValue={space.internalNotes ?? ""}
                      placeholder="Notas de operación solo visibles para el operador…"
                      onChange={() => setNotesDirty(true)}
                      className={inputCls}
                    />
                  </div>
                )}
                {!showInternalNotes && (
                  <input type="hidden" name="internalNotes" value={space.internalNotes ?? ""} />
                )}
              </div>
            </form>

            {/* Systems in this space — read-only */}
            {spaceSystems.length > 0 && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Sistemas en este espacio</p>
                  <Link
                    href={`/properties/${propertyId}/systems`}
                    className="text-xs font-medium text-[var(--color-text-link)] hover:underline"
                  >
                    Gestionar →
                  </Link>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {spaceSystems.map((sys) => (
                    <li key={sys.id}>
                      <Link
                        href={`/properties/${propertyId}/systems/${sys.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--color-action-primary-subtle)] bg-[var(--color-action-primary-subtle)] px-3 py-0.5 text-xs text-[var(--color-action-primary-subtle-fg)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-action-primary-subtle-fg)] hover:no-underline"
                      >
                        {sys.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Media gallery — only mount when expanded to avoid N server calls on page load */}
            {expanded && (
              <div className="mt-4">
                <EntityGallery
                  propertyId={propertyId}
                  entityType="space"
                  entityId={space.id}
                  label="Fotos"
                  defaultCollapsed
                  compact
                />
              </div>
            )}

            {/* Footer — outside form to avoid nested <form> */}
            <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-default)] pt-4">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  form={`details-${space.id}`}
                  disabled={detailsPending || !formDirty}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 py-2 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
                >
                  {detailsPending ? "Guardando…" : "Guardar cambios"}
                </button>
                {saveStatus && <InlineSaveStatus status={saveStatus} />}
                {detailsState?.error && (
                  <span className="text-xs text-[var(--color-status-error-text)]">{detailsState.error}</span>
                )}
              </div>

              {isArchived ? (
                <form action={archiveAction}>
                  <input type="hidden" name="spaceId" value={space.id} />
                  <input type="hidden" name="status" value="active" />
                  <button
                    type="submit"
                    disabled={archivePending}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--color-action-primary-subtle-fg)] transition-colors hover:bg-[var(--color-interactive-hover)] disabled:opacity-50"
                  >
                    {archivePending ? "Restaurando…" : "Restaurar espacio"}
                  </button>
                  {archiveState?.error && (
                    <span className="ml-2 text-xs text-[var(--color-status-error-text)]">{archiveState.error}</span>
                  )}
                </form>
              ) : confirmArchive ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-status-warning-text)]">¿Archivar este espacio?</span>
                  <form action={archiveAction}>
                    <input type="hidden" name="spaceId" value={space.id} />
                    <input type="hidden" name="status" value="archived" />
                    <button
                      type="submit"
                      disabled={archivePending}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-status-warning-solid)] px-3 py-1.5 text-xs font-medium text-[var(--color-status-warning-solid-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {archivePending ? "Archivando…" : "Sí, archivar"}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(false)}
                    className="text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                  >
                    Cancelar
                  </button>
                  {archiveState?.error && (
                    <span className="text-xs text-[var(--color-status-error-text)]">{archiveState.error}</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Archivar espacio
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ── Section wrapper — clear visual separation between topics ──

function SpaceSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="my-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-4 py-4 first:mt-0">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
        <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-action-primary)]" />
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Flat feature section — renders fields inside a SpaceSection ──

function FlatFeatureSection({
  group,
  features,
  onChangeFeature,
  noBorder,
}: {
  group: SpaceFeatureGroup;
  features: FeatureState;
  onChangeFeature: (fieldId: string, value: FeatureValue) => void;
  noBorder?: boolean;
}) {
  const boolFields = group.fields.filter((f) => {
    if (f.type !== "boolean") return false;
    if (f.shown_if) {
      const depValue = features[f.shown_if.field];
      if (depValue !== f.shown_if.equals) return false;
    }
    return true;
  });

  const structuredFields = group.fields.filter((f) => {
    if (f.type === "boolean") return false;
    if (f.shown_if) {
      const depValue = features[f.shown_if.field];
      if (depValue !== f.shown_if.equals) return false;
    }
    return true;
  });

  if (boolFields.length === 0 && structuredFields.length === 0) return null;

  const content = (
    <>
      {boolFields.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {boolFields.map((field) => {
            const active = Boolean(features[field.id]);
            return (
              <Tooltip key={field.id} text={field.description}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeFeature(field.id, !active)}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    active
                      ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] shadow-sm"
                      : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-interactive-hover)]",
                  )}
                >
                  {active && <Check size={13} aria-hidden="true" className="mr-1" />}
                  {field.label}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {structuredFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          {structuredFields.map((field) => (
            <StructuredField
              key={field.id}
              field={field}
              value={features[field.id] ?? null}
              onChange={(v) => onChangeFeature(field.id, v)}
            />
          ))}
        </div>
      )}
    </>
  );

  if (noBorder) return <>{content}</>;
  return content;
}

// ── Structured field: enum, enum_multiselect, number, text, text_chips ──

function StructuredField({
  field,
  value,
  onChange,
}: {
  field: SpaceFeatureField;
  value: FeatureValue;
  onChange: (v: FeatureValue) => void;
}) {
  const tooltipText = field.tooltip ?? null;
  const labelCls = "mb-1 flex items-center gap-0.5 text-xs font-semibold text-[var(--color-text-primary)]";
  const selectCls =
    "block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none";

  if (field.type === "enum" && field.options) {
    return (
      <label className="block">
        <span className={labelCls}>
          {field.label}
          {tooltipText && <InfoTooltip text={tooltipText} />}
        </span>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={selectCls}
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "enum_multiselect" && field.options) {
    const selected = (value as string[]) ?? [];
    return (
      <div className="col-span-2 sm:col-span-3">
        <p className={labelCls}>
          {field.label}
          {tooltipText && <InfoTooltip text={tooltipText} />}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {field.options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={checked}
                onClick={() => {
                  const next = checked
                    ? selected.filter((id) => id !== opt.id)
                    : [...selected, opt.id];
                  onChange(next.length > 0 ? next : null);
                }}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  checked
                    ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] shadow-sm"
                    : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-interactive-hover)]",
                )}
              >
                {checked && <Check size={13} aria-hidden="true" className="mr-1" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "number_optional" || field.type === "integer_optional") {
    return (
      <label className="block">
        <span className={labelCls}>
          {field.label}
          {tooltipText && <InfoTooltip text={tooltipText} />}
        </span>
        <input
          type="number"
          step={field.type === "integer_optional" ? "1" : "0.1"}
          min={0}
          value={(value as number) ?? ""}
          onChange={(e) => {
            if (e.target.value === "") { onChange(null); return; }
            const n = Number(e.target.value);
            onChange(field.type === "integer_optional" ? Math.trunc(n) : n);
          }}
          placeholder="—"
          className={selectCls}
        />
      </label>
    );
  }

  if (field.type === "text") {
    return (
      <div className="col-span-2 sm:col-span-3">
        <label className="block">
          <span className={labelCls}>
            {field.label}
            {tooltipText && <InfoTooltip text={tooltipText} />}
          </span>
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="Describe brevemente…"
            className={cn(selectCls, "placeholder:text-[var(--color-text-placeholder)]")}
          />
        </label>
      </div>
    );
  }

  if (field.type === "text_chips") {
    return (
      <TextChipsField
        field={field}
        value={value}
        onChange={onChange}
        labelCls={labelCls}
      />
    );
  }

  return null;
}

// ── Text chips field — press Enter to add a custom tag ──

function TextChipsField({
  field,
  value,
  onChange,
  labelCls,
}: {
  field: SpaceFeatureField;
  value: FeatureValue;
  onChange: (v: FeatureValue) => void;
  labelCls: string;
}) {
  const [draft, setDraft] = useState("");
  const chips = (value as string[]) ?? [];
  const tooltipText = field.tooltip ?? null;

  function addChip() {
    const trimmed = draft.trim();
    if (!trimmed || chips.includes(trimmed)) { setDraft(""); return; }
    onChange([...chips, trimmed]);
    setDraft("");
  }

  function removeChip(chip: string) {
    const next = chips.filter((c) => c !== chip);
    onChange(next.length > 0 ? next : null);
  }

  return (
    <div className="col-span-2 sm:col-span-3">
      <p className={labelCls}>
        {field.label}
        {tooltipText && <InfoTooltip text={tooltipText} />}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-action-primary-fg)]"
          >
            {chip}
            <button
              type="button"
              onClick={() => removeChip(chip)}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-70 hover:opacity-100"
              aria-label={`Eliminar ${chip}`}
            >
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addChip(); }
          }}
          placeholder="Escribe y pulsa Enter…"
          className="h-8 min-w-[160px] flex-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-focus)] focus:outline-none"
        />
      </div>
    </div>
  );
}
