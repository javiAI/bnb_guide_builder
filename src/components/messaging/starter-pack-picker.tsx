"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Package, X } from "lucide-react";
import {
  applyStarterPackAction,
  previewStarterPackAction,
} from "@/lib/actions/messaging.actions";
import type {
  StarterPackPreview,
  StarterPackSummary,
} from "@/lib/services/messaging-seed.service";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";

const TONE_LABEL: Record<string, string> = {
  friendly: "Cercano",
  formal: "Profesional",
  luxury: "Exclusivo",
};

const LOCALE_LABEL: Record<string, string> = {
  es: "Español",
  en: "English",
};

interface StarterPackPickerProps {
  propertyId: string;
  packs: StarterPackSummary[];
  hasPackRows: boolean;
  templateCount: number;
  touchpointLabels: Record<string, string>;
}

const PRIMARY_BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]";

export function StarterPackPicker({
  propertyId,
  packs,
  hasPackRows,
  templateCount,
  touchpointLabels,
}: StarterPackPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [preview, setPreview] = useState<StarterPackPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, startApply] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setSelectedPackId(null);
    setPreview(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDrawer]);

  useEffect(() => {
    if (!selectedPackId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setError(null);
    previewStarterPackAction(propertyId, selectedPackId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setPreview(res.preview);
        } else {
          setError(res.error);
          setPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPackId, propertyId]);

  const isEmpty = templateCount === 0 && !hasPackRows;

  const onApply = () => {
    if (!selectedPackId) return;
    startApply(async () => {
      const fd = new FormData();
      fd.set("propertyId", propertyId);
      fd.set("packId", selectedPackId);
      const result = await applyStarterPackAction(null, fd);
      if (result.success && "result" in result && result.result) {
        setSuccessMsg(formatApplyMessage(result.result));
        closeDrawer();
      } else {
        setError("error" in result && result.error ? result.error : "Error al aplicar");
      }
    });
  };

  return (
    <>
      {successMsg && (
        <div
          className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] p-3 text-sm text-[var(--color-status-success-text)]"
          role="status"
        >
          {successMsg}
        </div>
      )}

      {isEmpty ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] p-5">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Empieza con un pack
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Plantillas pre-escritas por tono e idioma, con automatizaciones
            pre-cableadas (inactivas). Las revisas, editas y activas cuando
            quieras — no se envía nada sin tu OK.
          </p>
          <button type="button" onClick={() => setOpen(true)} className={`${PRIMARY_BTN} mt-3`}>
            <Package size={15} aria-hidden="true" />
            Cargar pack
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${SECONDARY_BTN} mt-4`}>
          <Package size={15} aria-hidden="true" />
          Cargar pack
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar pack de mensajería"
        >
          <div
            className="absolute inset-0 bg-[var(--color-background-scrim)]"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="relative m-4 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] shadow-[var(--card-shadow-hover)]">
            <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border-default)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Packs de mensajería
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Elige tono e idioma. El pack genera plantillas +
                  automatizaciones inactivas; luego las activas desde cada
                  touchpoint.
                </p>
              </div>
              <IconButton
                icon={X}
                size="sm"
                onClick={closeDrawer}
                aria-label="Cerrar"
              />
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {packs.map((pack) => {
                    const active = pack.id === selectedPackId;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setSelectedPackId(pack.id)}
                        aria-pressed={active}
                        className={`min-h-[44px] rounded-[var(--radius-md)] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] ${
                          active
                            ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)]"
                            : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-interactive-hover)]"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                          {pack.name}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <Badge label={TONE_LABEL[pack.tone] ?? pack.tone} tone="neutral" />
                          <Badge label={LOCALE_LABEL[pack.locale] ?? pack.locale} tone="neutral" />
                          <Badge label={`${pack.templateCount} plantillas`} tone="neutral" />
                        </span>
                        <span className="mt-2 block text-xs text-[var(--color-text-secondary)]">
                          {pack.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPackId && (
                <section className="border-t border-[var(--color-border-default)] px-5 py-4">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Preview
                  </h3>
                  {loadingPreview && (
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                      Cargando preview…
                    </p>
                  )}
                  {error && (
                    <p className="mt-2 text-sm text-[var(--color-status-error-text)]">
                      {error}
                    </p>
                  )}
                  {preview && !loadingPreview && (
                    <div className="mt-3 space-y-3">
                      {preview.propertyType === null && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Sin propertyType configurado en la propiedad — se aplicarán
                          los templates base (sin overrides).
                        </p>
                      )}
                      {preview.templates.map((tpl) => {
                        const label = touchpointLabels[tpl.touchpointKey] ?? tpl.touchpointKey;
                        return (
                          <article
                            key={tpl.touchpointKey}
                            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] p-3"
                          >
                            <header className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                {label}
                              </div>
                              <div className="flex gap-1.5">
                                {tpl.appliedOverridePropertyTypes && (
                                  <Badge label="Override propertyType" tone="success" />
                                )}
                                <Badge
                                  label={`${tpl.automation.triggerType} · ${tpl.automation.sendOffsetMinutes}min`}
                                  tone="neutral"
                                />
                              </div>
                            </header>
                            {tpl.subjectLine && (
                              <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                <strong>Asunto:</strong> {tpl.subjectLine}
                              </div>
                            )}
                            <pre className="mt-2 whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--color-background-subtle)] p-2 text-xs text-[var(--color-text-primary)]">
                              {tpl.bodyResolved}
                            </pre>
                            {tpl.resolution.missing +
                              tpl.resolution.unknown +
                              tpl.resolution.unresolvedContext >
                              0 && (
                              <div className="mt-2 flex gap-2 text-xs">
                                {tpl.resolution.missing > 0 && (
                                  <Badge label={`${tpl.resolution.missing} sin dato`} tone="warning" />
                                )}
                                {tpl.resolution.unresolvedContext > 0 && (
                                  <Badge label={`${tpl.resolution.unresolvedContext} reserva`} tone="neutral" />
                                )}
                                {tpl.resolution.unknown > 0 && (
                                  <Badge label={`${tpl.resolution.unknown} desconocida`} tone="danger" />
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-border-default)] px-5 py-3">
              <button type="button" onClick={closeDrawer} className={SECONDARY_BTN}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={!selectedPackId || applying || !!error}
                className={PRIMARY_BTN}
              >
                {applying
                  ? "Aplicando…"
                  : hasPackRows
                    ? "Reemplazar pack"
                    : "Aplicar pack"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function formatApplyMessage(
  result: import("@/lib/services/messaging-seed.service").ApplyStarterPackResult,
): string {
  const {
    templatesCreated,
    templatesUpdated,
    templatesUnchanged,
    templatesRemoved,
    userOwnedSlotsPreserved,
  } = result;

  const applied = templatesCreated + templatesUpdated;
  if (applied === 0 && templatesRemoved === 0 && userOwnedSlotsPreserved === 0) {
    return `Pack ya al día (${templatesUnchanged} ${plural(templatesUnchanged, "plantilla", "plantillas")} sin cambios).`;
  }

  const parts: string[] = [];
  if (templatesCreated > 0) {
    parts.push(`${templatesCreated} ${plural(templatesCreated, "creada", "creadas")}`);
  }
  if (templatesUpdated > 0) {
    parts.push(`${templatesUpdated} ${plural(templatesUpdated, "actualizada", "actualizadas")}`);
  }
  if (templatesUnchanged > 0) {
    parts.push(`${templatesUnchanged} sin cambios`);
  }
  if (templatesRemoved > 0) {
    parts.push(`${templatesRemoved} ${plural(templatesRemoved, "eliminada del pack anterior", "eliminadas del pack anterior")}`);
  }
  if (userOwnedSlotsPreserved > 0) {
    parts.push(`${userOwnedSlotsPreserved} ${plural(userOwnedSlotsPreserved, "preservada (editada por ti)", "preservadas (editadas por ti)")}`);
  }
  return `Pack aplicado: ${parts.join(", ")}.`;
}
