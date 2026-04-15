"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  renameSpaceAction,
  updateSpaceDetailsAction,
  archiveSpaceAction,
  type ActionResult,
} from "@/lib/actions/editor.actions";
import {
  spaceTypes,
  findItem,
  bedTypes,
  getSpaceFeatureGroups,
  getSpaceTypeItem,
} from "@/lib/taxonomy-loader";
import type { SpaceFeatureGroup, SpaceFeatureField } from "@/lib/types/taxonomy";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Tooltip } from "@/components/ui/tooltip";
import { BedManager, type BedData } from "./bed-manager";


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
}

type FeatureValue = string | number | boolean | string[] | null;
type FeatureState = Record<string, FeatureValue>;

const inputCls =
  "block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

function computeProgressDot(
  features: FeatureState,
  featureGroups: import("@/lib/types/taxonomy").SpaceFeatureGroup[],
  hasBeds: boolean,
  bedCount: number,
): "none" | "partial" | "complete" {
  const filledFeatures = Object.values(features).filter(
    (v) => v !== null && v !== false && v !== "" && !(Array.isArray(v) && v.length === 0),
  ).length;

  const hasAny = filledFeatures > 0 || (hasBeds && bedCount > 0);
  if (!hasAny) return "none";

  // "complete" = at least one field filled per non-dimensions group
  const contentGroups = featureGroups.filter((g) => g.id !== "sfg.dimensions");
  if (contentGroups.length === 0) return hasBeds && bedCount > 0 ? "complete" : "partial";

  const groupsWithData = contentGroups.filter((g) =>
    g.fields.some((f) => {
      const v = features[f.id];
      return v !== null && v !== undefined && v !== false && v !== "" && !(Array.isArray(v) && v.length === 0);
    })
  );
  if (groupsWithData.length >= contentGroups.length) return "complete";
  return "partial";
}

export function SpaceCard({ propertyId, maxGuests, space, beds, spaceSystems = [] }: SpaceCardProps) {
  // ── Expand / collapse ──
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
  const progressDot = computeProgressDot(features, featureGroups, hasBeds, beds.length);

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

  return (
    <div className={`rounded-[var(--radius-lg)] border-2 transition-colors duration-200 ${isArchived ? "border-dashed border-[var(--border)] bg-[var(--color-neutral-50)] opacity-70" : "border-[var(--border)] bg-[var(--surface-elevated)]"}`}>
      {/* ── Card header ── */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${!editingName ? "cursor-pointer select-none" : ""}`}
        role={!editingName ? "button" : undefined}
        tabIndex={!editingName ? 0 : undefined}
        aria-expanded={!editingName ? expanded : undefined}
        onClick={() => { if (!editingName) setExpanded((e) => !e); }}
        onKeyDown={(e) => {
          if (editingName) return;
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((prev) => !prev); }
        }}
      >
        <div className="flex-1 min-w-0">
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
                className="rounded-[var(--radius-md)] border border-[var(--color-primary-400)] bg-[var(--surface)] px-2 py-1 text-sm font-semibold text-[var(--foreground)] focus:outline-none w-full max-w-xs"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={renamePending || !nameValue.trim()}
                className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {renamePending ? "…" : "✓"}
              </button>
              <button
                type="button"
                onClick={() => { setNameValue(space.name); setEditingName(false); }}
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-100)]"
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <span className="text-sm font-semibold text-[var(--foreground)] truncate">
                {nameValue}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingName(true); }}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] transition-opacity"
                title="Renombrar espacio"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                </svg>
              </button>
            </div>
          )}
          <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
            {typeInfo?.label ?? space.spaceType}
            {capacityLabel && ` · ${capacityLabel}`}
          </p>
          {renameState?.error && (
            <p className="mt-0.5 text-xs text-[var(--color-danger-500)]">{renameState.error}</p>
          )}
        </div>

        {/* Right: progress dot + expand toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {progressDot !== "none" && (
            <Tooltip text={progressDot === "complete" ? "Espacio completo" : "Información parcial"}>
              <span
                role="img"
                aria-label={progressDot === "complete" ? "Espacio completo" : "Información parcial"}
                className={`h-2 w-2 rounded-full ${
                  progressDot === "complete"
                    ? "bg-[var(--color-success-500,#22c55e)]"
                    : "bg-[var(--color-warning-400,#facc15)]"
                }`}
              />
            </Tooltip>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((prev) => !prev); }}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] transition-colors"
            aria-label={expanded ? "Colapsar espacio" : "Expandir espacio"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Collapsible body ── */}
      <div
        ref={bodyRef}
        style={{ maxHeight: height === "auto" ? "none" : `${height}px` }}
        className="overflow-hidden transition-all duration-300 ease-in-out"
      >
        {bodyVisible && (
          <div className="border-t border-[var(--border)] px-4 pb-6 pt-4 space-y-1">

            {/* Photos first */}
            <SpaceSection label="Fotos y vídeo">
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 w-24 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--surface)] flex flex-col items-center justify-center gap-0.5 text-[var(--color-neutral-400)] cursor-not-allowed"
                    title="Subida de fotos — próximamente"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[9px]">{i === 0 ? "Principal" : `Foto ${i + 1}`}</span>
                  </div>
                ))}
                <div
                  className="h-16 w-24 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--surface)] flex flex-col items-center justify-center gap-0.5 text-[var(--color-neutral-400)] cursor-not-allowed"
                  title="Vídeo — próximamente"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
                  </svg>
                  <span className="text-[9px]">Vídeo</span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-neutral-500)]">
                Disponible próximamente — podrás asociar fotos a cada zona del espacio.
              </p>
            </SpaceSection>

            {/* Beds — pass maxGuests for inline capacity warning */}
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
              <input type="hidden" name="featuresJson" value={JSON.stringify(features)} />

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
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-neutral-500)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-3.5 w-3.5 transition-transform duration-150 ${showInternalNotes ? "rotate-90" : ""}`}
                  >
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                  Notas internas
                  {space.internalNotes && (
                    <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-neutral-400)]" />
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
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--color-neutral-50)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[var(--color-neutral-600)]">Sistemas en este espacio</p>
                  <Link
                    href={`/properties/${propertyId}/systems`}
                    className="text-xs text-[var(--color-primary-500)] hover:text-[var(--color-primary-700)]"
                  >
                    Gestionar →
                  </Link>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {spaceSystems.map((sys) => (
                    <li key={sys.id}>
                      <Link
                        href={`/properties/${propertyId}/systems/${sys.id}`}
                        className="inline-flex items-center rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-2.5 py-0.5 text-xs text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
                      >
                        {sys.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer — outside form to avoid nested <form> */}
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 mt-2">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  form={`details-${space.id}`}
                  disabled={detailsPending || !formDirty}
                  className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
                >
                  {detailsPending ? "Guardando…" : "Guardar cambios"}
                </button>
                {saveStatus && <InlineSaveStatus status={saveStatus} />}
                {detailsState?.error && (
                  <span className="text-xs text-[var(--color-danger-500)]">{detailsState.error}</span>
                )}
              </div>

              {isArchived ? (
                <form action={archiveAction}>
                  <input type="hidden" name="spaceId" value={space.id} />
                  <input type="hidden" name="status" value="active" />
                  <button
                    type="submit"
                    disabled={archivePending}
                    className="rounded-[var(--radius-md)] border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] disabled:opacity-50"
                  >
                    {archivePending ? "Restaurando…" : "Restaurar espacio"}
                  </button>
                  {archiveState?.error && (
                    <span className="ml-2 text-xs text-[var(--color-danger-500)]">{archiveState.error}</span>
                  )}
                </form>
              ) : confirmArchive ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-warning-700)]">¿Archivar este espacio?</span>
                  <form action={archiveAction}>
                    <input type="hidden" name="spaceId" value={space.id} />
                    <input type="hidden" name="status" value="archived" />
                    <button
                      type="submit"
                      disabled={archivePending}
                      className="rounded-[var(--radius-md)] bg-[var(--color-warning-600)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-warning-700)] disabled:opacity-50"
                    >
                      {archivePending ? "Archivando…" : "Sí, archivar"}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(false)}
                    className="text-xs text-[var(--color-neutral-500)] hover:text-[var(--foreground)]"
                  >
                    Cancelar
                  </button>
                  {archiveState?.error && (
                    <span className="text-xs text-[var(--color-danger-500)]">{archiveState.error}</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="text-xs font-medium text-[var(--color-neutral-600)] hover:text-[var(--foreground)] transition-colors"
                >
                  Archivar espacio
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section wrapper — clear visual separation between topics ──

function SpaceSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-4 my-2 first:mt-0">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-neutral-600)] mb-3 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-primary-400)] flex-shrink-0" />
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
        <div className="flex flex-wrap gap-2 mb-3">
          {boolFields.map((field) => {
            const active = Boolean(features[field.id]);
            return (
              <Tooltip key={field.id} text={field.description}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeFeature(field.id, !active)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)] text-white shadow-sm"
                      : "border-[var(--color-neutral-300)] bg-[var(--surface-elevated)] text-[var(--color-neutral-700)] hover:border-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)]"
                  }`}
                >
                  {active && <span className="mr-1">✓</span>}
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
  const labelCls = "mb-1 flex items-center gap-0.5 text-xs font-semibold text-[var(--foreground)]";

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
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
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
        <div className="flex flex-wrap gap-2 mt-1">
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
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  checked
                    ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)] text-white shadow-sm"
                    : "border-[var(--color-neutral-300)] bg-[var(--surface-elevated)] text-[var(--color-neutral-700)] hover:border-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)]"
                }`}
              >
                {checked && <span className="mr-1">✓</span>}
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
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
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
            className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none placeholder:text-[var(--color-neutral-400)]"
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
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary-500)] bg-[var(--color-primary-500)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            {chip}
            <button
              type="button"
              onClick={() => removeChip(chip)}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-70 hover:opacity-100"
              aria-label={`Eliminar ${chip}`}
            >
              ✕
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
          className="h-8 flex-1 min-w-[160px] rounded-full border border-[var(--color-neutral-300)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
        />
      </div>
    </div>
  );
}
