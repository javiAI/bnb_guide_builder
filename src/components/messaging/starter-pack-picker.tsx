"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  applyStarterPackAction,
  previewStarterPackAction,
} from "@/lib/actions/messaging.actions";
import type {
  StarterPackPreview,
  StarterPackSummary,
} from "@/lib/services/messaging-seed.service";
import { Badge } from "@/components/ui/badge";
import { messagingTouchpoints, getItems } from "@/lib/taxonomy-loader";

const TOUCHPOINT_LABEL = new Map(
  getItems(messagingTouchpoints).map((t) => [t.id, t.label]),
);

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
}

export function StarterPackPicker({
  propertyId,
  packs,
  hasPackRows,
  templateCount,
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
        const { templatesCreated, replacedTemplates } = result.result;
        const verb = replacedTemplates > 0 ? "Reemplazado" : "Aplicado";
        setSuccessMsg(
          `${verb}: ${templatesCreated} plantillas + automations (inactivas) creadas.`,
        );
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
          className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-success-500)] bg-[var(--color-success-50)] p-3 text-sm text-[var(--color-neutral-700)]"
          role="status"
        >
          {successMsg}
        </div>
      )}

      {isEmpty ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-primary-400)] bg-[var(--color-primary-50)] p-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Empieza con un pack
          </h2>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            Plantillas pre-escritas por tono e idioma, con automations pre-cableadas
            (inactivas). Las revisas, editas y activas cuando quieras — no se envía
            nada sin tu OK.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)]"
          >
            Cargar pack
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--color-primary-400)]"
        >
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
            className="absolute inset-0 bg-[var(--color-neutral-900)]/50"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="relative m-4 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-elevated)] shadow-xl">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Packs de mensajería
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
                  Elige tono e idioma. El pack genera plantillas + automations
                  inactivas; luego las activas desde cada touchpoint.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-[var(--radius-md)] px-2 py-1 text-sm text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-100)]"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </header>

            <div className="max-h-[calc(90vh-5rem)] overflow-y-auto">
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {packs.map((pack) => {
                    const active = pack.id === selectedPackId;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setSelectedPackId(pack.id)}
                        className={`rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
                          active
                            ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                            : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--color-primary-400)]"
                        }`}
                      >
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          {pack.name}
                        </div>
                        <div className="mt-1 flex gap-1.5">
                          <Badge label={TONE_LABEL[pack.tone] ?? pack.tone} tone="neutral" />
                          <Badge
                            label={LOCALE_LABEL[pack.locale] ?? pack.locale}
                            tone="neutral"
                          />
                          <Badge label={`${pack.templateCount} plantillas`} tone="neutral" />
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-neutral-500)]">
                          {pack.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPackId && (
                <section className="border-t border-[var(--border)] px-5 py-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    Preview
                  </h3>
                  {loadingPreview && (
                    <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
                      Cargando preview…
                    </p>
                  )}
                  {error && (
                    <p className="mt-2 text-sm text-[var(--color-danger-500)]">
                      {error}
                    </p>
                  )}
                  {preview && !loadingPreview && (
                    <div className="mt-3 space-y-3">
                      {preview.propertyType === null && (
                        <p className="text-xs text-[var(--color-neutral-500)]">
                          Sin propertyType configurado en la propiedad — se aplicarán
                          los templates base (sin overrides).
                        </p>
                      )}
                      {preview.templates.map((tpl) => {
                        const label = TOUCHPOINT_LABEL.get(tpl.touchpointKey) ?? tpl.touchpointKey;
                        return (
                          <article
                            key={tpl.touchpointKey}
                            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
                          >
                            <header className="flex items-center justify-between">
                              <div className="text-sm font-medium text-[var(--foreground)]">
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
                              <div className="mt-2 text-xs text-[var(--color-neutral-500)]">
                                <strong>Asunto:</strong> {tpl.subjectLine}
                              </div>
                            )}
                            <pre className="mt-2 whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--color-neutral-50)] p-2 text-xs text-[var(--foreground)]">
                              {tpl.bodyResolved}
                            </pre>
                            {tpl.resolution.missing +
                              tpl.resolution.unknown +
                              tpl.resolution.unresolvedContext >
                              0 && (
                              <div className="mt-2 flex gap-2 text-xs">
                                {tpl.resolution.missing > 0 && (
                                  <Badge
                                    label={`${tpl.resolution.missing} sin dato`}
                                    tone="warning"
                                  />
                                )}
                                {tpl.resolution.unresolvedContext > 0 && (
                                  <Badge
                                    label={`${tpl.resolution.unresolvedContext} reserva`}
                                    tone="neutral"
                                  />
                                )}
                                {tpl.resolution.unknown > 0 && (
                                  <Badge
                                    label={`${tpl.resolution.unknown} desconocida`}
                                    tone="danger"
                                  />
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

            <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--color-neutral-100)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={!selectedPackId || applying || !!error}
                className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:cursor-not-allowed disabled:bg-[var(--color-neutral-300)]"
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
