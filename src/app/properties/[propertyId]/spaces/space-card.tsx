"use client";

import { useActionState, useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDot,
  Cog,
  Minus,
  Move,
  Plus,
  Ruler,
  StickyNote,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  renameSpaceAction,
  updateSpaceDetailsAction,
  deleteSpaceAction,
} from "@/lib/actions/editor.actions";
import { deleteMediaAction } from "@/lib/actions/media.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { spaceTypes, getSpaceTypeItem } from "@/lib/taxonomies/space-types";
import { bedTypes } from "@/lib/taxonomies/bed-types";
import { getSpaceFeatureGroups } from "@/lib/taxonomies/space-features";
import { findItem } from "@/lib/taxonomies/_helpers";
import type { SpaceFeatureGroup, SpaceFeatureField } from "@/lib/types/taxonomy";
import type { BadgeTone } from "@/lib/types";
import { getSpaceIcon } from "@/lib/icons/space-icons";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { autoSaveSubmit, useFormAutoSave } from "@/lib/use-form-auto-save";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Tooltip } from "@/components/ui/tooltip";
import {
  EntityMediaCard,
  EntityCardStatusPill,
  type EntityCardRole,
} from "@/components/ui/entity-media-card";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { SpaceMediaUpload } from "./space-media-upload";
import {
  MediaCarousel,
  type MediaCarouselSlide,
} from "@/components/ui/media-carousel";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { SpaceSystemsCoverage, type SpaceCoverageSystem } from "./space-systems-coverage";
import { FieldInput, fieldControlClass } from "@/components/ui/field";
import type { SpaceMediaSlide } from "@/lib/services/space-media.service";
import type { SubsystemSlide } from "../access/_components/subsystem-card.types";
import { cn } from "@/lib/cn";
import { BedManager, type BedData } from "./bed-manager";
import {
  computeSpaceStatus,
  type FeatureState,
  type FeatureValue,
  type SpaceProgressLevel,
} from "./space-progress";

// Shared photo lightbox (same one Access cards use). Loaded lazily so its
// static maplibre dependency (only exercised by Access's map slides — Spaces
// never has them) stays out of the Spaces initial bundle; it loads on the
// first lightbox open.
const MediaLightbox = dynamic(
  () => import("../access/_components/media-lightbox").then((m) => m.MediaLightbox),
  { ssr: false },
);

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

interface SpaceCardProps {
  propertyId: string;
  /** Allowed guests + total bed places across ALL spaces — for the in-space
   * over-capacity hint under the bed list. */
  maxGuests: number | null;
  propertyBedCapacity: number;
  /** Property-wide dimension defaults — inherited (shown as placeholder) unless
   * the space sets its own value. */
  propertyAreaSqm?: number | null;
  propertyCeilingCm?: number | null;
  space: SpaceData;
  beds: BedData[];
  /** Editable per-space system coverage (Opción 1). */
  coverageSystems?: SpaceCoverageSystem[];
  /** Cover-carousel slides (images first, then videos) — from loadSpaceMedia. */
  slides: readonly SpaceMediaSlide[];
  photoCount?: number;
  videoCount?: number;
  /** Accordion role + handlers (owned by the parent grid via useCockpitAccordion). */
  role: EntityCardRole;
  onExpand: () => void;
  onCollapse: () => void;
}

const PLACEHOLDER_GRADIENT =
  "linear-gradient(135deg, var(--color-action-primary-subtle), var(--color-background-muted))";

const STATUS_META: Record<
  SpaceProgressLevel,
  { tone: BadgeTone; icon: LucideIcon; label: string }
> = {
  // Intuitive completion progression: empty ring -> ring+dot -> ring+check.
  complete: { tone: "success", icon: CircleCheck, label: "Completa" },
  partial: { tone: "warning", icon: CircleDot, label: "En progreso" },
  none: { tone: "neutral", icon: Circle, label: "Sin datos" },
};

function toCarouselSlides(slides: readonly SpaceMediaSlide[]): MediaCarouselSlide[] {
  return slides.map((s) =>
    s.kind === "image"
      ? { id: s.id, title: s.title, kind: "image", url: s.url, alt: s.alt }
      : { id: s.id, title: s.title, kind: "video", alt: s.alt },
  );
}

export function SpaceCard({
  propertyId,
  maxGuests,
  propertyBedCapacity,
  propertyAreaSqm = null,
  propertyCeilingCm = null,
  space,
  beds,
  coverageSystems = [],
  slides,
  photoCount = 0,
  videoCount = 0,
  role,
  onExpand,
  onCollapse,
}: SpaceCardProps) {
  const titleId = useId();
  const bodyId = useId();
  const isArchived = space.status === "archived";

  // ── Feature state (live progress + auto-saved via hidden mirror) ──
  const [features, setFeatures] = useState<FeatureState>(
    (space.featuresJson as FeatureState) ?? {},
  );
  function setFeature(fieldId: string, value: FeatureValue) {
    setFeatures((prev) => ({ ...prev, [fieldId]: value }));
  }
  const featureGroups = useMemo(() => getSpaceFeatureGroups(space.spaceType), [space.spaceType]);
  const hasBeds = (getSpaceTypeItem(space.spaceType)?.allowsSleeping ?? false) || beds.length > 0;
  const progressLevel = useMemo(
    () => computeSpaceStatus({ features, isSleeping: hasBeds, bedCount: beds.length, hasPhoto: photoCount > 0 }),
    [features, hasBeds, beds.length, photoCount],
  );
  const featuresJson = useMemo(() => JSON.stringify(features), [features]);
  const status = STATUS_META[progressLevel];

  // ── Cover carousel ──
  const carouselSlides = useMemo(() => toCarouselSlides(slides), [slides]);
  const [carouselIdx, setCarouselIdx] = useState(0);
  useEffect(() => {
    const max = Math.max(0, carouselSlides.length - 1);
    setCarouselIdx((prev) => Math.min(prev, max));
  }, [carouselSlides.length]);

  // ── Photo lightbox (shared MediaLightbox, same as Access cards) ──
  const router = useRouter();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const usageKey = `space.${space.id}`;
  const lightboxSlides = useMemo<SubsystemSlide[]>(
    () =>
      slides.map((s) => ({
        id: s.id,
        assetId: s.assetId,
        kind: s.kind,
        url: s.url,
        alt: s.alt,
        blurhash: s.blurhash,
        title: s.title,
        usageKey,
      })),
    [slides, usageKey],
  );
  const uploadConfig = useMemo(
    () => ({ propertyId, entityType: "space" as const, entityId: space.id, usageKey }),
    [propertyId, space.id, usageKey],
  );
  const openLightbox = useCallback((idx: number) => {
    setLightboxIdx(idx);
    setCarouselIdx(idx);
  }, []);
  const handleSlideDelete = useCallback(
    async (assetId: string) => {
      await deleteMediaAction(assetId);
      router.refresh();
    },
    [router],
  );

  // ── Auto-save forms ──
  // Name is edited inline on the card title (InlineEditText pattern), not a form
  // field — commit dispatches the rename action directly.
  const [renameState, renameAction, renamePending] = useActionState<ActionResult | null, FormData>(
    renameSpaceAction,
    null,
  );
  const [, startRenameTransition] = useTransition();
  const handleRename = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === space.name) return;
      const fd = new FormData();
      fd.append("spaceId", space.id);
      fd.append("name", trimmed);
      // useActionState dispatch must run inside a transition (imperative call).
      startRenameTransition(() => { renameAction(fd); });
    },
    [space.id, space.name, renameAction],
  );

  const detailsFormRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(detailsFormRef);
  const [detailsState, detailsAction, detailsPending] = useActionState<ActionResult | null, FormData>(
    updateSpaceDetailsAction,
    null,
  );

  const [showInternalNotes, setShowInternalNotes] = useState(Boolean(space.internalNotes));
  const [internalNotes, setInternalNotes] = useState(space.internalNotes ?? "");

  // ── Derived (facts + icon) ──
  const TypeIcon = getSpaceIcon(space.spaceType);
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
  const areaSqm = features["sf.area_sqm"];
  const areaLabel = typeof areaSqm === "number" && areaSqm > 0 ? `${areaSqm} m²` : null;

  // Space-owned facts only (never amenities/systems): type · area · capacity.
  const facts: { key: string; icon: LucideIcon; label: string }[] = [
    { key: "type", icon: TypeIcon, label: typeInfo?.label ?? space.spaceType },
  ];
  if (areaLabel) facts.push({ key: "area", icon: Move, label: areaLabel });
  if (capacityLabel) facts.push({ key: "cap", icon: UsersRound, label: capacityLabel });

  // `pr-24` reserves the bottom-right corner for the upload/delete cluster so the
  // facts never run under the controls — on coarse pointers they're always shown.
  const collapsedContent = (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 pr-24 text-[12px] text-[var(--color-text-secondary)]">
      {facts.map((f) => (
        <span key={f.key} className="inline-flex items-center gap-1">
          <f.icon size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
          {f.label}
        </span>
      ))}
    </div>
  );

  const media = (
    <MediaCarousel
      slides={carouselSlides}
      propertyId={propertyId}
      title={space.name}
      variant={role === "active" ? "active" : "collapsed"}
      uploadEntityType="space"
      uploadEntityId={space.id}
      uploadUsageKey={usageKey}
      placeholderGradient={PLACEHOLDER_GRADIENT}
      currentIdx={carouselIdx}
      onCurrentIdxChange={setCarouselIdx}
      onLightboxOpen={openLightbox}
      {...(role === "active" ? {} : { bodyId, onExpand })}
    />
  );

  const overlay =
    lightboxIdx !== null ? (
      <MediaLightbox
        slides={lightboxSlides}
        index={lightboxIdx}
        onIndexChange={openLightbox}
        onClose={() => setLightboxIdx(null)}
        onSlideDelete={handleSlideDelete}
        uploadConfig={uploadConfig}
      />
    ) : null;

  // ── Delete + media-upload affordances (shared across collapsed/expanded) ──
  const deleteAction = deleteSpaceAction as (
    prev: { success: boolean } | null,
    formData: FormData,
  ) => Promise<{ success: boolean }>;
  const deleteDescription = `Se eliminará "${space.name}" y todos sus datos (camas, fotos y características). Esta acción no se puede deshacer.`;

  // Collapsed: action cluster at the body's bottom-right corner — NOT over the
  // cover (the cover keeps its own expand affordance) and clear of the facts row
  // (which reserves `pr-24`). Hover-revealed on fine pointers (clean idle card)
  // but ALWAYS visible on coarse pointers — on touch there is no hover, so the
  // controls must stay on screen or the operator can't add photos / delete.
  // `pointer-events-none` only while hidden, so it never dead-zones the expand
  // button on fine pointers.
  const hoverOverlay = (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100">
      <SpaceMediaUpload propertyId={propertyId} spaceId={space.id} />
      <DeleteConfirmationButton
        title="Eliminar espacio"
        description={deleteDescription}
        entityId={space.id}
        fieldName="spaceId"
        action={deleteAction}
        triggerClassName="rounded-full bg-[var(--color-background-muted)]"
      />
    </div>
  );

  // Expanded: the same upload control in the header.
  const headerAction = (
    <SpaceMediaUpload propertyId={propertyId} spaceId={space.id} className="mr-4" />
  );

  // ── Editor body — only built in the active role. EntityMediaCard ignores
  // children when collapsed, so skip the element-tree allocation for the grid
  // cards that aren't expanded.
  const editor = role !== "active" ? null : (
    <div className="space-y-6">
      {renameState?.error && (
        <p className="-mt-2 text-xs text-[var(--color-status-error-text)]">{renameState.error}</p>
      )}

      {/* Dimensiones — superficie + altura heredan de Propiedad (placeholder +
         badge "heredado") y se sobrescriben por-espacio. Las controla el estado
         `features` → espejo al hidden featuresJson → auto-guardado. */}
      <EditorSection icon={Ruler} label="Dimensiones">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <InheritedNumberField
            label="Superficie útil"
            unit="m²"
            value={features["sf.area_sqm"] as number | null}
            inherited={propertyAreaSqm}
            onChange={(v) => setFeature("sf.area_sqm", v)}
          />
          <InheritedNumberField
            label="Altura de techo"
            unit="cm"
            integer
            value={features["sf.ceiling_height_cm"] as number | null}
            inherited={propertyCeilingCm}
            onChange={(v) => setFeature("sf.ceiling_height_cm", v)}
          />
        </div>
      </EditorSection>

      {/* Beds — BedManager renders its own forms, so it stays OUTSIDE the
         details <form> (no nested forms). */}
      {hasBeds && (
        <EditorSection icon={BedDouble} label="Camas">
          <BedManager propertyId={propertyId} spaceId={space.id} beds={beds} maxGuests={maxGuests} propertyBedCapacity={propertyBedCapacity} />
        </EditorSection>
      )}

      {/* Systems coverage — part of the per-space essentials (Dimensiones ·
         Camas · Sistemas), before the type-specific details. Every configured
         system is selectable here. Own action + form, so it lives OUTSIDE the
         details <form> (no nested forms, no auto-save cross-talk). */}
      <EditorSection icon={Cog} label="Sistemas en esta estancia">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Marca los sistemas que llegan a esta estancia.
          </p>
          <Link
            href={`/properties/${propertyId}/systems`}
            className="text-xs font-medium text-[var(--color-text-link)] hover:underline"
          >
            Gestionar →
          </Link>
        </div>
        <div className="mt-2">
          <SpaceSystemsCoverage propertyId={propertyId} spaceId={space.id} systems={coverageSystems} />
        </div>
      </EditorSection>

      {/* Details form — type-specific feature groups + notes (auto-saved). Each
         group renders its main options on the left and any conditional reveals
         in a right-hand detail panel. */}
      <form id={`details-${space.id}`} ref={detailsFormRef} onSubmit={autoSaveSubmit(detailsAction)} className="space-y-6">
        <input type="hidden" name="spaceId" value={space.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="featuresJson" value={featuresJson} />

        {(() => {
          const bodyGroups = featureGroups.filter((g) => g.id !== "sfg.dimensions");
          const zonesPresent = new Set(bodyGroups.map((g) => g.zone).filter(Boolean));
          const useZones = zonesPresent.size >= 2;
          const renderGroup = (group: SpaceFeatureGroup) => (
            <EditorSection key={group.id} label={group.label}>
              {group.operatorHint && (
                <p className="mb-2 text-xs text-[var(--color-text-muted)]">{group.operatorHint}</p>
              )}
              <GroupFields group={group} features={features} onChangeFeature={setFeature} />
            </EditorSection>
          );
          if (useZones) {
            const zones: { label: string | null; groups: SpaceFeatureGroup[] }[] = [];
            for (const g of bodyGroups) {
              const z = g.zone ?? null;
              const last = zones[zones.length - 1];
              if (last && last.label === z) last.groups.push(g);
              else zones.push({ label: z, groups: [g] });
            }
            return (
              <div className="space-y-8">
                {zones.map((zone, i) => (
                  <div key={i} className="space-y-5">
                    {zone.label && <ZoneHeader label={zone.label} />}
                    {zone.groups.map(renderGroup)}
                  </div>
                ))}
              </div>
            );
          }
          return <div className="space-y-6">{bodyGroups.map(renderGroup)}</div>;
        })()}

        <EditorSection icon={StickyNote} label="Notas para el huésped">
          <textarea
            name="guestNotes"
            rows={2}
            aria-label="Notas para el huésped"
            defaultValue={space.guestNotes ?? ""}
            placeholder="Información útil sobre este espacio visible en la guía del huésped…"
            className={fieldControlClass}
          />
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowInternalNotes((v) => !v)}
              className="flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn("-rotate-90 transition-transform duration-150", showInternalNotes && "rotate-0")}
              />
              Notas internas
              {internalNotes && (
                <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
              )}
            </button>
            {showInternalNotes ? (
              <textarea
                name="internalNotes"
                rows={2}
                aria-label="Notas internas"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notas de operación solo visibles para el operador…"
                className={cn(fieldControlClass, "mt-2")}
              />
            ) : (
              <input type="hidden" name="internalNotes" value={internalNotes} />
            )}
          </div>
        </EditorSection>
      </form>

      {/* Photos are managed via the cover carousel (swipe + upload) and the
         shared MediaLightbox (view / add / delete) — same as Access cards. No
         separate gallery section. */}

      {/* Footer — autosave status (left) + a clearly-labeled delete (right). */}
      <div className="flex items-center justify-between border-t border-[var(--color-border-default)] pt-4">
        <div className="flex items-center gap-3">
          <AutoSaveStatus pending={detailsPending || renamePending} />
          {detailsState?.error && (
            <span className="text-xs text-[var(--color-status-error-text)]">{detailsState.error}</span>
          )}
        </div>

        <DeleteConfirmationButton
          title="Eliminar espacio"
          triggerLabel="Eliminar espacio"
          description={deleteDescription}
          entityId={space.id}
          fieldName="spaceId"
          action={deleteAction}
        />
      </div>
    </div>
  );

  return (
    <EntityMediaCard
      role={role}
      viewTransitionName={`space-card-${space.id}`}
      titleId={titleId}
      bodyId={bodyId}
      icon={TypeIcon}
      title={space.name}
      titleNode={
        role === "active" ? (
          <InlineEditText
            value={space.name}
            onCommit={handleRename}
            placeholder="Nombre del espacio"
            ariaLabel="Nombre del espacio"
            textClassName="text-[16px] font-semibold leading-tight text-[var(--color-text-primary)]"
            withTooltip
          />
        ) : undefined
      }
      status={<EntityCardStatusPill tone={status.tone} icon={status.icon} label={status.label} />}
      media={media}
      overlay={overlay}
      collapsedContent={collapsedContent}
      hoverOverlay={hoverOverlay}
      headerAction={headerAction}
      srOnly={
        <>
          {photoCount} {photoCount === 1 ? "foto" : "fotos"}
          {videoCount > 0 && <>, {videoCount} {videoCount === 1 ? "vídeo" : "vídeos"}</>}
        </>
      }
      onExpand={onExpand}
      onCollapse={onCollapse}
      className={isArchived ? "opacity-80" : undefined}
    >
      {editor}
    </EntityMediaCard>
  );
}

// ── Editor section — flat SectionEyebrow header + content (Access body rhythm) ──

function EditorSection({
  icon,
  label,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <SectionEyebrow icon={icon}>{label}</SectionEyebrow>
      {children}
    </section>
  );
}

// Multi-zone combos (cocina-salón-comedor…) group their feature sections under
// zone headers so the long body reads as Cocina · Salón · Comedor instead of a
// flat list. The zone label is config-driven (`group.zone` in space_features.json);
// single-zone types (a plain kitchen) skip the header — redundant.
function ZoneHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
      {label}
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border-default)]" />
    </div>
  );
}

// ── Inherited number field — value falls back to a property-wide default ──
// Shows the inherited value as the placeholder + a "heredado" badge until the
// space sets its own; typing a value overrides (stored in featuresJson).

function InheritedNumberField({
  label,
  unit,
  value,
  inherited,
  integer = false,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  inherited: number | null;
  integer?: boolean;
  onChange: (v: FeatureValue) => void;
}) {
  const hasOwn = value !== null && value !== undefined;
  const labelNode = (
    <span className="inline-flex items-center gap-1.5">
      {label} <span className="font-normal text-[var(--color-text-muted)]">({unit})</span>
      {!hasOwn && inherited != null && (
        <span className="rounded-full bg-[var(--color-background-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
          heredado
        </span>
      )}
    </span>
  );
  return (
    <FieldInput
      label={labelNode}
      type="number"
      min={0}
      step={integer ? "1" : "0.1"}
      inputMode={integer ? "numeric" : "decimal"}
      value={hasOwn ? String(value) : ""}
      placeholder={inherited != null ? `${inherited}` : "—"}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") { onChange(null); return; }
        const n = Number(raw);
        onChange(integer ? Math.trunc(n) : n);
      }}
    />
  );
}

// ── Feature group renderer — full-width main options, with any conditional
// (shown_if) reveals opening BELOW them (indented), never in a side column.
// "Añadir otro" stays inline at the end of its options. ──

type Block =
  | { kind: "chips"; bools: SpaceFeatureField[]; tags?: SpaceFeatureField }
  | { kind: "enum"; field: SpaceFeatureField }
  | { kind: "multiselect"; field: SpaceFeatureField; tags?: SpaceFeatureField }
  | { kind: "numbers"; fields: SpaceFeatureField[] }
  | { kind: "text"; field: SpaceFeatureField }
  | { kind: "tags"; field: SpaceFeatureField };

// Build render blocks in document order. Consecutive booleans / numbers group
// into one row; a trailing *_other_tags text_chips attaches to the preceding
// chip group or multiselect, so "Añadir otro…" always sits with its options.
function buildBlocks(fields: SpaceFeatureField[]): Block[] {
  const blocks: Block[] = [];
  for (const f of fields) {
    const last = blocks[blocks.length - 1];
    if (f.type === "boolean") {
      if (last && last.kind === "chips" && !last.tags) last.bools.push(f);
      else blocks.push({ kind: "chips", bools: [f] });
    } else if (f.type === "text_chips") {
      if (last && last.kind === "chips" && !last.tags) last.tags = f;
      else if (last && last.kind === "multiselect" && !last.tags) last.tags = f;
      else blocks.push({ kind: "tags", field: f });
    } else if (f.type === "enum_multiselect") {
      blocks.push({ kind: "multiselect", field: f });
    } else if (f.type === "enum") {
      blocks.push({ kind: "enum", field: f });
    } else if (f.type === "number_optional" || f.type === "integer_optional") {
      if (last && last.kind === "numbers") last.fields.push(f);
      else blocks.push({ kind: "numbers", fields: [f] });
    } else if (f.type === "text") {
      blocks.push({ kind: "text", field: f });
    }
  }
  return blocks;
}

function GroupFields({
  group,
  features,
  onChangeFeature,
}: {
  group: SpaceFeatureGroup;
  features: FeatureState;
  onChangeFeature: (fieldId: string, value: FeatureValue) => void;
}) {
  const isVisible = (f: SpaceFeatureField) =>
    !f.shown_if || features[f.shown_if.field] === f.shown_if.equals;
  const mainFields = group.fields.filter((f) => !f.shown_if);
  const revealFields = group.fields.filter((f) => f.shown_if && isVisible(f));
  const blocks = buildBlocks(mainFields);
  // A group whose only main control is a single labeled field is already named
  // by its section header — drop the redundant field label.
  const soleLabel =
    mainFields.length === 1 &&
    mainFields[0].type !== "boolean" &&
    mainFields[0].type !== "text_chips";

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => renderBlock(block, i, features, onChangeFeature, soleLabel))}
      {revealFields.length > 0 && (
        <div className="space-y-4 border-l-2 border-[var(--color-border-default)] pl-4">
          {revealFields.map((f) => (
            <RevealField
              key={f.id}
              field={f}
              value={features[f.id] ?? null}
              onChange={(v) => onChangeFeature(f.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function renderBlock(
  block: Block,
  key: number,
  features: FeatureState,
  onChangeFeature: (fieldId: string, value: FeatureValue) => void,
  soleLabel: boolean,
) {
  if (block.kind === "chips") {
    return (
      <div key={key} className="flex flex-wrap gap-2">
        {block.bools.map((f) => (
          <Tooltip key={f.id} text={f.description}>
            <ToggleChip active={Boolean(features[f.id])} onToggle={() => onChangeFeature(f.id, !features[f.id])}>
              {f.label}
            </ToggleChip>
          </Tooltip>
        ))}
        {block.tags && (
          <InlineTagChips value={features[block.tags.id] ?? null} onChange={(v) => onChangeFeature(block.tags!.id, v)} />
        )}
      </div>
    );
  }
  if (block.kind === "enum") {
    return <EnumChips key={key} field={block.field} hideLabel={soleLabel} value={(features[block.field.id] as string) ?? null} onChange={(v) => onChangeFeature(block.field.id, v)} />;
  }
  if (block.kind === "multiselect") {
    return (
      <MultiChips
        key={key}
        field={block.field}
        hideLabel={soleLabel}
        value={(features[block.field.id] as string[]) ?? null}
        onChange={(v) => onChangeFeature(block.field.id, v)}
        tagsValue={block.tags ? (features[block.tags.id] ?? null) : null}
        onTagsChange={block.tags ? (v) => onChangeFeature(block.tags!.id, v) : undefined}
      />
    );
  }
  if (block.kind === "numbers") {
    return (
      <div key={key} className="flex flex-wrap gap-x-6 gap-y-3">
        {block.fields.map((f) => (
          <NumberOrCount key={f.id} field={f} value={(features[f.id] as number) ?? null} onChange={(v) => onChangeFeature(f.id, v)} />
        ))}
      </div>
    );
  }
  if (block.kind === "text") {
    return <TextField key={key} field={block.field} value={(features[block.field.id] as string) ?? ""} onChange={(v) => onChangeFeature(block.field.id, v)} />;
  }
  return <LabeledTags key={key} field={block.field} value={features[block.field.id] ?? null} onChange={(v) => onChangeFeature(block.field.id, v)} />;
}

// A single shown_if field rendered in the right-hand detail panel.
function RevealField({ field, value, onChange }: { field: SpaceFeatureField; value: FeatureValue; onChange: (v: FeatureValue) => void }) {
  if (field.type === "enum") {
    return <EnumChips field={field} value={(value as string) ?? null} onChange={onChange} />;
  }
  if (field.type === "enum_multiselect") {
    return <MultiChips field={field} value={(value as string[]) ?? null} onChange={onChange} tagsValue={null} />;
  }
  if (field.type === "integer_optional" || field.type === "number_optional") {
    return <NumberOrCount field={field} value={(value as number) ?? null} onChange={onChange} />;
  }
  if (field.type === "text") {
    return <TextField field={field} value={(value as string) ?? ""} onChange={onChange} />;
  }
  if (field.type === "text_chips") {
    return <LabeledTags field={field} value={value} onChange={onChange} />;
  }
  // boolean reveal → a single labeled toggle chip
  return (
    <div>
      <Tooltip text={field.description}>
        <ToggleChip active={Boolean(value)} onToggle={() => onChange(!value)}>{field.label}</ToggleChip>
      </Tooltip>
    </div>
  );
}

// ── Field option renderers — one chips/options system, no dropdowns ──

function fieldLabelContent(field: SpaceFeatureField) {
  return (
    <>
      {field.label}
      {field.tooltip && <InfoTooltip text={field.tooltip} />}
    </>
  );
}

function FieldLabel({ field }: { field: SpaceFeatureField }) {
  return (
    <p className="mb-1.5 flex items-center gap-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
      {fieldLabelContent(field)}
    </p>
  );
}

function EnumChips({ field, value, onChange, hideLabel = false }: { field: SpaceFeatureField; value: string | null; onChange: (v: FeatureValue) => void; hideLabel?: boolean }) {
  const current = value ?? "";
  return (
    <div>
      {!hideLabel && <FieldLabel field={field} />}
      <div className="flex flex-wrap gap-2">
        {field.options?.map((opt) => (
          <ToggleChip key={opt.id} active={current === opt.id} hideCheck onToggle={() => onChange(current === opt.id ? null : opt.id)}>
            {opt.label}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

function MultiChips({
  field,
  value,
  onChange,
  tagsValue,
  onTagsChange,
  hideLabel = false,
}: {
  field: SpaceFeatureField;
  value: string[] | null;
  onChange: (v: FeatureValue) => void;
  tagsValue: FeatureValue;
  onTagsChange?: (v: FeatureValue) => void;
  hideLabel?: boolean;
}) {
  const selected = value ?? [];
  return (
    <div>
      {!hideLabel && <FieldLabel field={field} />}
      <div className="flex flex-wrap gap-2">
        {field.options?.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <ToggleChip
              key={opt.id}
              active={checked}
              onToggle={() => {
                const next = checked ? selected.filter((id) => id !== opt.id) : [...selected, opt.id];
                onChange(next.length > 0 ? next : null);
              }}
            >
              {opt.label}
            </ToggleChip>
          );
        })}
        {onTagsChange && <InlineTagChips value={tagsValue} onChange={onTagsChange} />}
      </div>
    </div>
  );
}

// Integer counts use a compact chip-height stepper (matches the bed config);
// decimals (m², m³…) keep a narrow numeric input.
const COUNT_BTN_CLS =
  "recipe-icon-btn-32 grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] disabled:opacity-40";

function NumberOrCount({ field, value, onChange }: { field: SpaceFeatureField; value: number | null; onChange: (v: FeatureValue) => void }) {
  if (field.type === "integer_optional") {
    const v = value ?? 0;
    const set = (n: number) => onChange(n <= 0 ? null : n);
    return (
      <div>
        <FieldLabel field={field} />
        <div className="inline-flex items-center gap-2">
          <button type="button" disabled={v <= 0} onClick={() => set(v - 1)} aria-label={`Reducir ${field.label}`} className={COUNT_BTN_CLS}>
            <Minus size={14} aria-hidden="true" />
          </button>
          <span className="min-w-[1.75rem] text-center text-sm font-semibold text-[var(--color-text-primary)]">{v}</span>
          <button type="button" onClick={() => set(v + 1)} aria-label={`Aumentar ${field.label}`} className={COUNT_BTN_CLS}>
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="w-28">
      <FieldInput
        label={fieldLabelContent(field)}
        type="number"
        step="0.1"
        min={0}
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => {
          if (e.target.value === "") { onChange(null); return; }
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
}

function TextField({ field, value, onChange }: { field: SpaceFeatureField; value: string; onChange: (v: FeatureValue) => void }) {
  return (
    <FieldInput
      label={fieldLabelContent(field)}
      type="text"
      value={value}
      placeholder="Describe brevemente…"
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

function LabeledTags({ field, value, onChange }: { field: SpaceFeatureField; value: FeatureValue; onChange: (v: FeatureValue) => void }) {
  return (
    <div>
      <FieldLabel field={field} />
      <div className="flex flex-wrap gap-2">
        <InlineTagChips value={value} onChange={onChange} />
      </div>
    </div>
  );
}

// ── Inline tag chips — custom tags + a dashed "Añadir otro…" chip, rendered
// inline within a group's chip row (no label, no wrapper section). ──

function InlineTagChips({
  value,
  onChange,
}: {
  value: FeatureValue;
  onChange: (v: FeatureValue) => void;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const chips = (value as string[]) ?? [];

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
    <>
      {chips.map((chip) => (
        <span
          key={chip}
          className="recipe-chip-28 inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 text-xs font-semibold text-[var(--color-action-primary-fg)]"
        >
          {chip}
          <button
            type="button"
            onClick={() => removeChip(chip)}
            className="ml-0.5 grid h-3.5 w-3.5 place-items-center rounded-full opacity-70 hover:opacity-100"
            aria-label={`Eliminar ${chip}`}
          >
            <X size={11} aria-hidden="true" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addChip(); }
            if (e.key === "Escape") { setDraft(""); setAdding(false); }
          }}
          onBlur={() => { addChip(); setAdding(false); }}
          placeholder="Escribe y pulsa Enter…"
          className="h-7 min-w-[150px] rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-focus)] focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="recipe-chip-28 inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-[var(--color-border-strong)] px-3 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <Plus size={13} aria-hidden="true" /> Añadir otro…
        </button>
      )}
    </>
  );
}
