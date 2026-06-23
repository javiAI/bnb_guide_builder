"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MutableRefObject,
} from "react";
import { CircleAlert } from "lucide-react";
import {
  deletePlaybookAction,
  renamePlaybookAction,
  updatePlaybookAction,
} from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { troubleshootingTaxonomy } from "@/lib/taxonomies/troubleshooting";
import { visibilityLevelsTaxonomy } from "@/lib/taxonomies/visibility-levels";
import { findItem, getItems } from "@/lib/taxonomies/_helpers";
import { SEVERITY_BADGE, SEVERITY_LEVELS } from "@/lib/troubleshooting-severity";
import { getTroubleshootingIcon } from "@/lib/icons/troubleshooting-icons";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { autoSaveSubmit, useFormAutoSave } from "@/lib/use-form-auto-save";
import { Badge } from "@/components/ui/badge";
import {
  EntityMediaCard,
  EntityCardStatusPill,
  type EntityCardRole,
} from "@/components/ui/entity-media-card";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { TextLink } from "@/components/ui/text-link";
import { FieldInput, FieldTextarea } from "@/components/ui/field";
import {
  computePlaybookStatus,
  missingPlaybookSignals,
  type PlaybookProgressLevel,
} from "./playbook-progress";

export type PlaybookTargetType = "none" | "system" | "amenity" | "space" | "access";

export interface TargetOption {
  value: string;
  label: string;
}

/** Target candidates per link type — computed once by the server page and
 * shared by every card (includes orphan "(ya no configurado)" entries). */
export interface PlaybookTargetOptions {
  system: TargetOption[];
  amenity: TargetOption[];
  space: TargetOption[];
  access: TargetOption[];
}

export interface PlaybookData {
  id: string;
  playbookKey: string;
  title: string;
  severity: string;
  symptomsMd: string;
  guestStepsMd: string;
  internalStepsMd: string;
  escalationRule: string;
  visibility: string;
  targetType: PlaybookTargetType;
  targetKey: string;
}

// Domain copy only — icon + tone come from the canonical entity-card
// vocabulary (check/dot/dashed) via EntityCardStatusPill.
const STATUS_LABEL: Record<PlaybookProgressLevel, string> = {
  complete: "Completa",
  partial: "En progreso",
  empty: "Sin contenido",
};

// Severity scale from the taxonomy (severity_levels) — zero hardcoded lists.
const severityOptions = SEVERITY_LEVELS.map((id) => ({
  value: id,
  label: SEVERITY_BADGE[id].label,
}));

const visibilityOptions = getItems(visibilityLevelsTaxonomy)
  .filter((v) => v.id !== "vis.sensitive")
  .map((v) => ({ value: v.id.replace(/^vis\./, ""), label: v.label }));

// NOT a taxonomy: these are the playbook model's four FK columns (structural
// shape), so the es-ES labels live in code by design (dossier §5.4).
const TARGET_TYPE_OPTIONS: { id: PlaybookTargetType; label: string }[] = [
  { id: "none", label: "Sin vincular" },
  { id: "system", label: "Sistema" },
  { id: "amenity", label: "Equipamiento" },
  { id: "space", label: "Espacio" },
  { id: "access", label: "Acceso" },
];

const TARGET_EMPTY_COPY: Record<Exclude<PlaybookTargetType, "none">, string> = {
  system: "No hay sistemas configurados todavía.",
  amenity: "No hay equipamiento configurado todavía.",
  space: "No hay espacios activos.",
  access: "No hay métodos de acceso disponibles.",
};

interface PlaybookCardProps {
  propertyId: string;
  playbook: PlaybookData;
  /** Open/in-progress incidents linked to this playbook (idle fact + footer). */
  openIncidents: number;
  targetOptions: PlaybookTargetOptions;
  /** Accordion role + handlers (owned by the parent grid via useCockpitAccordion). */
  role: EntityCardRole;
  onExpand: () => void;
  onCollapse: () => void;
  /** Grid-owned slot where the active card registers its autosave `flush()` so
   * EVERY collapse path (Escape / click-outside / chevron) persists the last
   * keystroke before the form unmounts. */
  flushRef: MutableRefObject<(() => void) | null>;
}

export function PlaybookCard({
  propertyId,
  playbook,
  openIncidents,
  targetOptions,
  role,
  onExpand,
  onCollapse,
  flushRef,
}: PlaybookCardProps) {
  const titleId = useId();
  const bodyId = useId();

  // ── Controlled content (live status pill; every field is name-bearing so the
  // autosave FormData diff is the change signal — no `watch` needed) ──
  const [severity, setSeverity] = useState(playbook.severity);
  const [visibility, setVisibility] = useState(playbook.visibility);
  const [symptomsMd, setSymptomsMd] = useState(playbook.symptomsMd);
  const [guestStepsMd, setGuestStepsMd] = useState(playbook.guestStepsMd);
  const [internalStepsMd, setInternalStepsMd] = useState(playbook.internalStepsMd);
  const [escalationRule, setEscalationRule] = useState(playbook.escalationRule);

  // ── Linked element — coherent mirrors (dossier §5.6): the hidden pair only
  // moves when a VALID pair exists. Picking a type (≠ none) opens the reveal
  // but keeps the last persisted pair in the mirrors until a target is chosen;
  // "Sin vincular" clears both at once. The autosave never submits a half pair.
  const [committedTarget, setCommittedTarget] = useState<{
    type: PlaybookTargetType;
    key: string;
  }>({ type: playbook.targetType, key: playbook.targetKey });
  const [selectedType, setSelectedType] = useState<PlaybookTargetType>(playbook.targetType);

  function pickTargetType(type: PlaybookTargetType) {
    setSelectedType(type);
    if (type === "none") setCommittedTarget({ type: "none", key: "" });
  }
  function pickTargetKey(key: string) {
    setCommittedTarget({ type: selectedType, key });
  }

  // ── Live status (same pure helpers the server aggregate uses) ──
  const { progressLevel, statusDetail } = useMemo(() => {
    const content = { severity, symptomsMd, guestStepsMd, internalStepsMd, escalationRule };
    const missing = missingPlaybookSignals(content);
    return {
      progressLevel: computePlaybookStatus(content),
      statusDetail: missing.length > 0 ? `Falta: ${missing.join(", ")}` : undefined,
    };
  }, [severity, symptomsMd, guestStepsMd, internalStepsMd, escalationRule]);

  // ── Rename — inline on the card title, dispatched directly ──
  const [renameState, renameAction, renamePending] = useActionState<ActionResult | null, FormData>(
    renamePlaybookAction,
    null,
  );
  const [, startRenameTransition] = useTransition();
  const handleRename = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === playbook.title) return;
      const fd = new FormData();
      fd.append("playbookId", playbook.id);
      fd.append("title", trimmed);
      startRenameTransition(() => {
        renameAction(fd);
      });
    },
    [playbook.id, playbook.title, renameAction],
  );

  // ── Details form (auto-saved; mounts only while active) ──
  const detailsFormRef = useRef<HTMLFormElement>(null);
  const flushDetails = useFormAutoSave(detailsFormRef);
  const [detailsState, detailsAction, detailsPending] = useActionState<ActionResult | null, FormData>(
    updatePlaybookAction,
    null,
  );

  // Register the flush with the grid while active — the accordion calls it
  // synchronously before the collapse commit, when the form is still mounted.
  useEffect(() => {
    if (role !== "active") return;
    flushRef.current = flushDetails;
    return () => {
      flushRef.current = null;
    };
  }, [role, flushDetails, flushRef]);

  // ── Derived (icon + idle facts) ──
  const TypeIcon = getTroubleshootingIcon(playbook.playbookKey);
  const typeInfo = findItem(troubleshootingTaxonomy, playbook.playbookKey);
  const typeLabel = typeInfo?.label ?? playbook.playbookKey;
  const sev = SEVERITY_BADGE[severity] ?? SEVERITY_BADGE.medium;

  // Idle facts row: type · severity · open incidents. Plain text only — this
  // lives inside the idle expand <button>, so no nested links.
  const collapsedContent = (
    <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--color-text-secondary)]">
      <span>{typeLabel}</span>
      <Badge label={sev.label} tone={sev.tone} />
      {openIncidents > 0 && (
        <span className="inline-flex items-center gap-1">
          <CircleAlert
            size={13}
            aria-hidden="true"
            className="flex-none text-[var(--color-status-error-text)]"
          />
          {openIncidents} {openIncidents === 1 ? "incidencia abierta" : "incidencias abiertas"}
        </span>
      )}
    </span>
  );

  const deleteDescription = `Se eliminará "${playbook.title}" y su contenido. Las incidencias vinculadas se conservan sin vínculo. Esta acción no se puede deshacer.`;

  // ── Editor body — only built in the active role ──
  const editor =
    role !== "active" ? null : (
      <div className="space-y-6">
        {renameState?.error && (
          <p className="-mt-2 text-xs text-[var(--color-status-error-text)]">{renameState.error}</p>
        )}

        <form ref={detailsFormRef} onSubmit={autoSaveSubmit(detailsAction)} className="space-y-6">
          <input type="hidden" name="playbookId" value={playbook.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          {/* Hidden mirrors — chips are buttons, so their values travel here. */}
          <input type="hidden" name="severity" value={severity} />
          <input type="hidden" name="visibility" value={visibility} />
          <input type="hidden" name="targetType" value={committedTarget.type} />
          <input type="hidden" name="targetKey" value={committedTarget.key} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionEyebrow>Clasificación</SectionEyebrow>
              <span className="flex items-center gap-3">
                {detailsState?.error && (
                  <span className="text-xs text-[var(--color-status-error-text)]">
                    {detailsState.error}
                  </span>
                )}
                <AutoSaveStatus pending={detailsPending || renamePending} />
              </span>
            </div>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                  Severidad
                </p>
                <div className="flex flex-wrap gap-2">
                  {severityOptions.map((opt) => (
                    <ToggleChip
                      key={opt.value}
                      active={severity === opt.value}
                      onToggle={() => setSeverity(opt.value)}
                    >
                      {opt.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                  Visibilidad
                </p>
                <div className="flex flex-wrap gap-2">
                  {visibilityOptions.map((opt) => (
                    <ToggleChip
                      key={opt.value}
                      active={visibility === opt.value}
                      onToggle={() => setVisibility(opt.value)}
                    >
                      {opt.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionEyebrow>Síntomas</SectionEyebrow>
            <FieldTextarea
              name="symptomsMd"
              aria-label="Síntomas"
              rows={3}
              value={symptomsMd}
              onChange={(e) => setSymptomsMd(e.target.value)}
              placeholder="Describe los síntomas que reporta el huésped…"
              help="Lo que el huésped suele describir."
            />
          </section>

          <section className="space-y-3">
            <SectionEyebrow>Pasos para el huésped</SectionEyebrow>
            <FieldTextarea
              name="guestStepsMd"
              aria-label="Pasos para el huésped"
              rows={4}
              value={guestStepsMd}
              onChange={(e) => setGuestStepsMd(e.target.value)}
              placeholder={"1. Intenta reiniciar…\n2. Si no funciona…"}
              help="Se publican en la guía y los usa el asistente."
            />
          </section>

          <section className="space-y-3">
            <SectionEyebrow>Pasos internos</SectionEyebrow>
            <FieldTextarea
              name="internalStepsMd"
              aria-label="Pasos internos"
              rows={4}
              value={internalStepsMd}
              onChange={(e) => setInternalStepsMd(e.target.value)}
              placeholder={"1. Verificar en el panel…\n2. Contactar al técnico…"}
              help="Solo visibles para el operador."
            />
          </section>

          <section className="space-y-3">
            <SectionEyebrow>Cuándo escalar</SectionEyebrow>
            <FieldInput
              name="escalationRule"
              aria-label="Cuándo escalar"
              type="text"
              value={escalationRule}
              onChange={(e) => setEscalationRule(e.target.value)}
              placeholder="Ej.: si no se resuelve en 30 minutos, avisar al técnico"
            />
          </section>

          <section className="space-y-3">
            <SectionEyebrow>Elemento vinculado</SectionEyebrow>
            <p className="text-xs text-[var(--color-text-muted)]">
              Asocia esta solución a un sistema, equipamiento, espacio o método de acceso para
              mostrarla en contexto.
            </p>
            <div className="flex flex-wrap gap-2">
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <ToggleChip
                  key={opt.id}
                  active={selectedType === opt.id}
                  onToggle={() => pickTargetType(opt.id)}
                >
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
            {selectedType !== "none" && (
              <div className="space-y-2 border-l-2 border-[var(--color-border-default)] pl-4">
                {targetOptions[selectedType].length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {TARGET_EMPTY_COPY[selectedType]}
                  </p>
                ) : (
                  <>
                    {(committedTarget.type !== selectedType || !committedTarget.key) && (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        El vínculo se guarda al elegir uno.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {targetOptions[selectedType].map((opt) => (
                        <ToggleChip
                          key={opt.value}
                          active={
                            committedTarget.type === selectedType &&
                            committedTarget.key === opt.value
                          }
                          onToggle={() => pickTargetKey(opt.value)}
                        >
                          {opt.label}
                        </ToggleChip>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </form>

        {/* Footer — OUTSIDE the details form (DeleteConfirmationButton mounts its
           own <form> inside the <dialog>; nesting it would be invalid HTML). */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-4">
          <TextLink
            size="sm"
            href={`/properties/${propertyId}/incidents?playbookId=${playbook.id}`}
            arrow
          >
            Ver incidencias de esta solución
            {openIncidents > 0 &&
              ` (${openIncidents} ${openIncidents === 1 ? "abierta" : "abiertas"})`}
          </TextLink>
          <DeleteConfirmationButton
            title="Eliminar solución"
            triggerLabel="Eliminar solución"
            description={deleteDescription}
            entityId={playbook.id}
            fieldName="playbookId"
            action={deletePlaybookAction}
          />
        </div>
      </div>
    );

  return (
    <EntityMediaCard
      role={role}
      compact
      viewTransitionName={`playbook-card-${playbook.id}`}
      domId={`playbook-${playbook.id}`}
      titleId={titleId}
      bodyId={bodyId}
      icon={TypeIcon}
      title={playbook.title}
      subtitle={typeLabel}
      titleNode={
        role === "active" ? (
          <InlineEditText
            value={playbook.title}
            onCommit={handleRename}
            placeholder="Nombre de la solución"
            ariaLabel="Nombre de la solución"
            textClassName="text-[16px] font-semibold leading-tight text-[var(--color-text-primary)]"
            withTooltip
          />
        ) : undefined
      }
      status={
        <EntityCardStatusPill
          status={progressLevel}
          label={STATUS_LABEL[progressLevel]}
          detail={statusDetail}
        />
      }
      collapsedContent={collapsedContent}
      onExpand={onExpand}
      onCollapse={onCollapse}
    >
      {editor}
    </EntityMediaCard>
  );
}
