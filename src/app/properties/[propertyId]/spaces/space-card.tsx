"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  renameSpaceAction,
  updateSpaceDetailsAction,
  deleteSpaceAction,
  type ActionResult,
} from "@/lib/actions/editor.actions";
import {
  spaceTypes,
  findItem,
  bedTypes,
  getSpaceFeatureGroups,
} from "@/lib/taxonomy-loader";
import type { SpaceFeatureGroup, SpaceFeatureField } from "@/lib/types/taxonomy";
import { Badge } from "@/components/ui/badge";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { BedManager, type BedData } from "./bed-manager";

// Space types that can have sleeping beds
const SPACE_TYPES_WITH_BEDS = new Set([
  "sp.bedroom",
  "sp.living_room",
  "sp.office",
  "sp.other",
]);

const VISIBILITY_OPTIONS = [
  { id: "public", label: "Público (visible en guía)" },
  { id: "booked_guest", label: "Solo huésped confirmado" },
  { id: "internal", label: "Interno (operador)" },
];

interface SpaceData {
  id: string;
  spaceType: string;
  name: string;
  guestNotes: string | null;
  aiNotes: string | null;
  internalNotes: string | null;
  visibility: string;
  featuresJson: Record<string, unknown> | null;
}

interface SpaceCardProps {
  propertyId: string;
  space: SpaceData;
  beds: BedData[];
}

type FeatureValue = string | number | boolean | string[] | null;
type FeatureState = Record<string, FeatureValue>;

const inputCls =
  "block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

const sectionLabelCls =
  "text-[10px] font-semibold uppercase tracking-widest text-[var(--color-neutral-400)] mb-3";

export function SpaceCard({ propertyId, space, beds }: SpaceCardProps) {
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
    if (renameState?.success) setEditingName(false);
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
  const featureGroups = getSpaceFeatureGroups(space.spaceType);

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

  // Notes dirty tracking (uncontrolled fields — track via onChange)
  const [notesDirty, setNotesDirty] = useState(false);
  const formDirty = featuresDirty || notesDirty;

  const saveStatus = detailsPending
    ? "saving"
    : detailsState?.success
      ? "saved"
      : detailsState?.error
        ? "error"
        : undefined;

  // ── Delete ──
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteSpaceAction,
    null,
  );

  // ── Derived ──
  const typeInfo = findItem(spaceTypes, space.spaceType);
  const totalCapacity = beds.reduce((sum, bed) => {
    const bt = findItem(bedTypes, bed.bedType);
    return sum + (bt?.sleepingCapacity ?? 1) * bed.quantity;
  }, 0);

  const visLabel =
    space.visibility === "public"
      ? "Público"
      : space.visibility === "booked_guest"
        ? "Huésped"
        : "Interno";
  const visTone: "success" | "neutral" =
    space.visibility === "public" ? "success" : "neutral";

  return (
    <div className="rounded-[var(--radius-lg)] border-2 transition-colors duration-200 border-[var(--border)] bg-[var(--surface-elevated)]">
      {/* ── Card header ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Left: name + type */}
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
                onClick={() => {
                  setNameValue(space.name);
                  setEditingName(false);
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                }}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] transition-opacity"
                title="Renombrar espacio"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                </svg>
              </button>
            </div>
          )}
          <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
            {typeInfo?.label ?? space.spaceType}
            {totalCapacity > 0 && ` · ${totalCapacity} pers.`}
          </p>
          {renameState?.error && (
            <p className="mt-0.5 text-xs text-[var(--color-danger-500)]">{renameState.error}</p>
          )}
        </div>

        {/* Right: visibility + expand toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge label={visLabel} tone={visTone} />
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] transition-colors"
            aria-label={expanded ? "Colapsar espacio" : "Expandir espacio"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
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
          <div className="border-t border-[var(--border)] px-4 pb-5 pt-5 space-y-6">
            {/* Beds (only for applicable types) */}
            {SPACE_TYPES_WITH_BEDS.has(space.spaceType) && (
              <section>
                <p className={sectionLabelCls}>Camas</p>
                <BedManager propertyId={propertyId} spaceId={space.id} beds={beds} />
              </section>
            )}

            {/* Feature sections — flat, always visible */}
            <form id={`details-${space.id}`} action={detailsAction} className="space-y-6">
              <input type="hidden" name="spaceId" value={space.id} />
              <input type="hidden" name="propertyId" value={propertyId} />
              <input type="hidden" name="featuresJson" value={JSON.stringify(features)} />

              {featureGroups.map((group) => (
                <FlatFeatureSection
                  key={group.id}
                  group={group}
                  features={features}
                  onChangeFeature={setFeature}
                />
              ))}

              {/* Notes + visibility */}
              <section>
                <p className={sectionLabelCls}>Notas y visibilidad</p>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-neutral-600)]">
                      Notas para el huésped{" "}
                      <span className="font-normal text-[var(--color-neutral-400)]">(público)</span>
                    </span>
                    <textarea
                      name="guestNotes"
                      rows={2}
                      defaultValue={space.guestNotes ?? ""}
                      placeholder="Información útil para el huésped sobre este espacio…"
                      onChange={() => setNotesDirty(true)}
                      className={inputCls}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-[var(--color-neutral-600)]">
                        Notas para AI{" "}
                        <span className="font-normal text-[var(--color-neutral-400)]">(knowledge base)</span>
                      </span>
                      <textarea
                        name="aiNotes"
                        rows={2}
                        defaultValue={space.aiNotes ?? ""}
                        placeholder="Contexto para el asistente…"
                        onChange={() => setNotesDirty(true)}
                        className={inputCls}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-[var(--color-neutral-600)]">
                        Notas internas{" "}
                        <span className="font-normal text-[var(--color-neutral-400)]">(solo operador)</span>
                      </span>
                      <textarea
                        name="internalNotes"
                        rows={2}
                        defaultValue={space.internalNotes ?? ""}
                        placeholder="Notas de operación…"
                        onChange={() => setNotesDirty(true)}
                        className={inputCls}
                      />
                    </label>
                  </div>

                  <label className="block max-w-xs">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-neutral-600)]">
                      Visibilidad
                    </span>
                    <select
                      name="visibility"
                      defaultValue={space.visibility}
                      onChange={() => setNotesDirty(true)}
                      className={inputCls}
                    >
                      {VISIBILITY_OPTIONS.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

            </form>

            {/* Footer: save left, delete right — outside form to avoid nested <form> */}
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
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
                  <span className="text-xs text-[var(--color-danger-500)]">
                    {detailsState.error}
                  </span>
                )}
              </div>

              {/* Delete */}
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-danger-700)]">
                    ¿Eliminar este espacio?
                  </span>
                  <form action={deleteAction}>
                    <input type="hidden" name="spaceId" value={space.id} />
                    <button
                      type="submit"
                      disabled={deletePending}
                      className="rounded-[var(--radius-md)] bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletePending ? "Eliminando…" : "Sí, eliminar"}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-[var(--color-neutral-500)] hover:text-[var(--foreground)]"
                  >
                    Cancelar
                  </button>
                  {deleteState?.error && (
                    <span className="text-xs text-[var(--color-danger-500)]">
                      {deleteState.error}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-medium text-[var(--color-danger-700)] hover:text-[var(--color-danger-900)] transition-colors"
                >
                  Eliminar espacio
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Flat feature section (no CollapsibleSection nesting — avoids early-return bug) ──

function FlatFeatureSection({
  group,
  features,
  onChangeFeature,
}: {
  group: SpaceFeatureGroup;
  features: FeatureState;
  onChangeFeature: (fieldId: string, value: FeatureValue) => void;
}) {
  // Separate boolean fields (pill toggles) from structured fields (inputs)
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

  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-neutral-400)] mb-3">
        {group.label}
      </p>

      {/* Boolean pills — compact flex-wrap grid */}
      {boolFields.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {boolFields.map((field) => {
            const active = Boolean(features[field.id]);
            return (
              <button
                key={field.id}
                type="button"
                aria-pressed={active}
                title={field.description}
                onClick={() => onChangeFeature(field.id, !active)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  active
                    ? "border-[var(--color-primary-400)] bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--color-neutral-500)] hover:border-[var(--color-neutral-400)] hover:text-[var(--foreground)]"
                }`}
              >
                {active && (
                  <span className="mr-1 text-[var(--color-primary-600)]">✓</span>
                )}
                {field.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Structured fields — grid */}
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
    </section>
  );
}

// ── Structured field: enum, enum_multiselect, number ──

function StructuredField({
  field,
  value,
  onChange,
}: {
  field: SpaceFeatureField;
  value: FeatureValue;
  onChange: (v: FeatureValue) => void;
}) {
  if (field.type === "enum" && field.options) {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-neutral-600)]">
          {field.label}
        </span>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "enum_multiselect" && field.options) {
    const selected = (value as string[]) ?? [];
    return (
      <div className="col-span-2 sm:col-span-3">
        <p className="mb-2 text-xs font-medium text-[var(--color-neutral-600)]">{field.label}</p>
        <div className="flex flex-wrap gap-2">
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
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  checked
                    ? "border-[var(--color-primary-400)] bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--color-neutral-500)] hover:border-[var(--color-neutral-400)] hover:text-[var(--foreground)]"
                }`}
              >
                {checked && <span className="mr-1 text-[var(--color-primary-600)]">✓</span>}
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
        <span className="mb-1 block text-xs font-medium text-[var(--color-neutral-600)]">
          {field.label}
        </span>
        <input
          type="number"
          step={field.type === "integer_optional" ? "1" : "0.1"}
          min={0}
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value !== "" ? Number(e.target.value) : null)}
          placeholder="—"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        />
      </label>
    );
  }

  return null;
}
