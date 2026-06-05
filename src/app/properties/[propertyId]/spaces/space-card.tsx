"use client";

import { useActionState, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  Check,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDot,
  Cog,
  Move,
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
import { useFormAutoSave } from "@/lib/use-form-auto-save";
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
import { FieldInput, FieldSelect, fieldControlClass } from "@/components/ui/field";
import type { SpaceMediaSlide } from "@/lib/services/space-media.service";
import type { SubsystemSlide } from "../access/_components/subsystem-card.types";
import { cn } from "@/lib/cn";
import { BedManager, type BedData } from "./bed-manager";
import {
  computeProgressDot,
  PROGRESS_PERCENT,
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
  { tone: BadgeTone; icon: LucideIcon; label: string; bar: string }
> = {
  // Intuitive completion progression: empty ring -> ring+dot -> ring+check.
  complete: { tone: "success", icon: CircleCheck, label: "Completa", bar: "bg-[var(--color-status-success-solid)]" },
  partial: { tone: "warning", icon: CircleDot, label: "En progreso", bar: "bg-[var(--color-status-warning-solid)]" },
  none: { tone: "neutral", icon: Circle, label: "Sin datos", bar: "bg-[var(--color-border-strong)]" },
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
  space,
  beds,
  spaceSystems = [],
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
    () => computeProgressDot(features, featureGroups, hasBeds, beds.length),
    [features, featureGroups, hasBeds, beds.length],
  );
  const featuresJson = useMemo(() => JSON.stringify(features), [features]);
  const status = STATUS_META[progressLevel];
  const percent = PROGRESS_PERCENT[progressLevel];

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
    () => ({ propertyId, entityType: "space" as const, usageKey }),
    [propertyId, usageKey],
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
  const renameFormRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(renameFormRef);
  const [renameState, renameAction, renamePending] = useActionState<ActionResult | null, FormData>(
    renameSpaceAction,
    null,
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

  const collapsedContent = (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-text-secondary)]">
        {facts.map((f) => (
          <span key={f.key} className="inline-flex items-center gap-1">
            <f.icon size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
            {f.label}
          </span>
        ))}
      </div>
      <span className="flex items-center gap-2 text-[11px] font-medium text-[var(--color-text-secondary)]">
        <span className="h-[3px] max-w-[72px] flex-1 overflow-hidden rounded-full bg-[var(--color-progress-track)]">
          <span className={cn("block h-full rounded-full", status.bar)} style={{ width: `${percent}%` }} />
        </span>
        {percent}%
      </span>
    </div>
  );

  const media = (
    <MediaCarousel
      slides={carouselSlides}
      propertyId={propertyId}
      title={space.name}
      variant={role === "active" ? "active" : "collapsed"}
      uploadEntityType="space"
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

  // Collapsed: hover-revealed action cluster at the body's bottom-right corner
  // — NOT over the cover (the cover keeps its own expand affordance) and clear
  // of the progress row on the left. `pointer-events-none` until revealed so it
  // never creates a dead zone over the expand button when hidden.
  const hoverOverlay = (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
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
      {/* Name */}
      <form ref={renameFormRef} action={renameAction}>
        <input type="hidden" name="spaceId" value={space.id} />
        <FieldInput
          name="name"
          label="Nombre del espacio"
          required
          defaultValue={space.name}
          autoComplete="off"
          placeholder="Ej: Dormitorio principal"
        />
        {renameState?.error && (
          <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{renameState.error}</p>
        )}
      </form>

      {/* Dimensions — controls update `features` state → mirrored into the
         details form's hidden featuresJson input → auto-saved. */}
      {(() => {
        const dimGroup = featureGroups.find((g) => g.id === "sfg.dimensions");
        if (!dimGroup) return null;
        return (
          <EditorSection icon={Ruler} label="Dimensiones">
            <FlatFeatureSection group={dimGroup} features={features} onChangeFeature={setFeature} />
          </EditorSection>
        );
      })()}

      {/* Beds — BedManager renders its own forms, so it stays OUTSIDE the
         details <form> (no nested forms). */}
      {hasBeds && (
        <EditorSection icon={BedDouble} label="Camas">
          <BedManager propertyId={propertyId} spaceId={space.id} beds={beds} maxGuests={maxGuests} />
        </EditorSection>
      )}

      {/* Details form — feature groups + notes (auto-saved). */}
      <form id={`details-${space.id}`} ref={detailsFormRef} action={detailsAction} className="space-y-6">
        <input type="hidden" name="spaceId" value={space.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="featuresJson" value={featuresJson} />

        {featureGroups
          .filter((g) => g.id !== "sfg.dimensions")
          .map((group) => (
            <EditorSection key={group.id} label={group.label}>
              <FlatFeatureSection group={group} features={features} onChangeFeature={setFeature} />
            </EditorSection>
          ))}

        {featureGroups.length > 0 && (
          <EditorSection label="Otros detalles">
            <textarea
              rows={2}
              aria-label="Otros detalles"
              value={(features["sf.custom"] as string) ?? ""}
              onChange={(e) => setFeature("sf.custom", e.target.value || null)}
              placeholder="Cualquier detalle relevante que no encaje en las secciones anteriores…"
              className={fieldControlClass}
            />
          </EditorSection>
        )}

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

      {/* Systems in this space — read-only */}
      {spaceSystems.length > 0 && (
        <EditorSection icon={Cog} label="Sistemas en este espacio">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-secondary)]">Configurados desde Sistemas.</p>
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
        </EditorSection>
      )}

      {/* Photos are managed via the cover carousel (swipe + upload) and the
         shared MediaLightbox (view / add / delete) — same as Access cards. No
         separate gallery section. */}

      {/* Footer — autosave status + archive/restore */}
      <div className="flex items-center justify-between border-t border-[var(--color-border-default)] pt-4">
        <div className="flex items-center gap-3">
          <AutoSaveStatus pending={detailsPending || renamePending} />
          {detailsState?.error && (
            <span className="text-xs text-[var(--color-status-error-text)]">{detailsState.error}</span>
          )}
        </div>

        <DeleteConfirmationButton
          title="Eliminar espacio"
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

// ── Flat feature section — boolean chips + structured fields ──

function FlatFeatureSection({
  group,
  features,
  onChangeFeature,
}: {
  group: SpaceFeatureGroup;
  features: FeatureState;
  onChangeFeature: (fieldId: string, value: FeatureValue) => void;
}) {
  const visible = (f: SpaceFeatureField) => {
    if (f.shown_if) {
      const depValue = features[f.shown_if.field];
      if (depValue !== f.shown_if.equals) return false;
    }
    return true;
  };
  const boolFields = group.fields.filter((f) => f.type === "boolean" && visible(f));
  const structuredFields = group.fields.filter((f) => f.type !== "boolean" && visible(f));

  if (boolFields.length === 0 && structuredFields.length === 0) return null;

  return (
    <>
      {boolFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
}

// ── Structured field: enum / enum_multiselect / number / text / text_chips ──

function StructuredField({
  field,
  value,
  onChange,
}: {
  field: SpaceFeatureField;
  value: FeatureValue;
  onChange: (v: FeatureValue) => void;
}) {
  const labelNode = (
    <>
      {field.label}
      {field.tooltip && <InfoTooltip text={field.tooltip} />}
    </>
  );

  if (field.type === "enum" && field.options) {
    return (
      <FieldSelect
        label={labelNode}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {field.options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </FieldSelect>
    );
  }

  if (field.type === "enum_multiselect" && field.options) {
    const selected = (value as string[]) ?? [];
    return (
      <div className="col-span-2 sm:col-span-3">
        <p className="mb-1 flex items-center gap-0.5 text-xs font-semibold text-[var(--color-text-primary)]">{labelNode}</p>
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
      <FieldInput
        label={labelNode}
        type="number"
        step={field.type === "integer_optional" ? "1" : "0.1"}
        min={0}
        value={(value as number) ?? ""}
        placeholder="—"
        onChange={(e) => {
          if (e.target.value === "") { onChange(null); return; }
          const n = Number(e.target.value);
          onChange(field.type === "integer_optional" ? Math.trunc(n) : n);
        }}
      />
    );
  }

  if (field.type === "text") {
    return (
      <div className="col-span-2 sm:col-span-3">
        <FieldInput
          label={labelNode}
          type="text"
          value={(value as string) ?? ""}
          placeholder="Describe brevemente…"
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    );
  }

  if (field.type === "text_chips") {
    return <TextChipsField value={value} onChange={onChange} labelNode={labelNode} />;
  }

  return null;
}

// ── Text chips field — press Enter to add a custom tag ──

function TextChipsField({
  value,
  onChange,
  labelNode,
}: {
  value: FeatureValue;
  onChange: (v: FeatureValue) => void;
  labelNode: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
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
    <div className="col-span-2 sm:col-span-3">
      <p className="mb-1 flex items-center gap-0.5 text-xs font-semibold text-[var(--color-text-primary)]">{labelNode}</p>
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
