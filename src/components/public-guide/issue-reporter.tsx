"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useId, useState } from "react";
import { incidentCategories } from "@/lib/taxonomies/incident-categories";

/** Rama 13D — Guest-facing incident reporter.
 *
 * Mirrors `GuideSearch` dialog styling (shared `guide-reporter__*` tokens +
 * some overrides from `guide-search__*`) so both drawers feel like siblings.
 * Keeps its own inline form: 3 fields (category chip, summary, optional
 * contact). No photos (13D explicitly excludes uploads — needs public
 * upload endpoint that doesn't exist yet).
 */

interface Props {
  slug: string;
}

const SUMMARY_MAX = 500;
const CONTACT_MAX = 200;

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; trackUrl: string }
  | { kind: "error"; message: string };

export function IssueReporter({ slug }: Props) {
  const [open, setOpen] = useState(false);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const summaryId = useId();
  const contactId = useId();

  const reset = useCallback(() => {
    setCategoryKey(null);
    setSummary("");
    setContact("");
    setState({ kind: "idle" });
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) reset();
    },
    [reset],
  );

  const trimmedSummary = summary.trim();
  const trimmedContact = contact.trim();
  const canSubmit =
    categoryKey !== null &&
    trimmedSummary.length > 0 &&
    trimmedSummary.length <= SUMMARY_MAX &&
    trimmedContact.length <= CONTACT_MAX &&
    state.kind !== "loading";

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit || !categoryKey) return;
      setState({ kind: "loading" });
      try {
        const res = await fetch(`/api/g/${slug}/incidents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryKey,
            summary: trimmedSummary,
            guestContactOptional: trimmedContact || undefined,
          }),
        });
        if (res.status === 429) {
          const body = (await res.json().catch(() => null)) as {
            retryAfterSeconds?: number;
          } | null;
          const retry = body?.retryAfterSeconds ?? 60;
          setState({
            kind: "error",
            message: `Demasiados envíos. Inténtalo de nuevo en ${retry}s.`,
          });
          return;
        }
        if (res.status === 410) {
          setState({
            kind: "error",
            message: "Esta guía ya no está disponible.",
          });
          return;
        }
        if (!res.ok) {
          setState({
            kind: "error",
            message: "No se pudo enviar. Revisa el texto y vuelve a intentarlo.",
          });
          return;
        }
        const body = (await res.json()) as {
          incidentId: string;
          trackUrl: string;
        };
        setState({ kind: "ok", trackUrl: body.trackUrl });
      } catch {
        setState({
          kind: "error",
          message: "Sin conexión. Inténtalo de nuevo cuando recuperes señal.",
        });
      }
    },
    [canSubmit, categoryKey, trimmedSummary, trimmedContact, slug],
  );

  const summaryRemaining = SUMMARY_MAX - summary.length;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="guide-reporter__trigger"
          aria-label="Reportar una incidencia"
        >
          <AlertIcon aria-hidden="true" />
          <span className="guide-reporter__trigger-label">Reportar problema</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="guide-search__overlay" />
        <Dialog.Content
          className="guide-search__dialog guide-reporter__dialog"
          aria-label="Reportar una incidencia"
          onOpenAutoFocus={(e) => {
            // Prevent Radix from auto-focusing the close button — we focus
            // the first category chip so keyboard users land on the choice.
            e.preventDefault();
            const first = (e.currentTarget as HTMLElement).querySelector<
              HTMLButtonElement
            >("[data-reporter-first-chip]");
            first?.focus();
          }}
        >
          <Dialog.Title className="guide-reporter__title">
            Reportar una incidencia
          </Dialog.Title>
          <Dialog.Description className="guide-reporter__description">
            El anfitrión recibirá tu aviso y podrá contactarte si hace falta.
          </Dialog.Description>
          {state.kind === "ok" ? (
            <div className="guide-reporter__success" role="status">
              <p className="guide-reporter__success-title">
                Aviso enviado ✓
              </p>
              <p className="guide-reporter__success-copy">
                Guarda este enlace para seguir el estado desde este dispositivo.
              </p>
              <a
                href={state.trackUrl}
                className="guide-reporter__primary"
              >
                Ver seguimiento
              </a>
            </div>
          ) : (
            <form className="guide-reporter__form" onSubmit={handleSubmit}>
              <fieldset className="guide-reporter__fieldset">
                <legend className="guide-reporter__legend">
                  ¿Qué está pasando?
                </legend>
                <div
                  className="guide-reporter__chips"
                  role="radiogroup"
                  aria-label="Tipo de incidencia"
                >
                  {incidentCategories.items.map((cat, idx) => {
                    const selected = categoryKey === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-reporter-first-chip={idx === 0 ? "" : undefined}
                        onClick={() => setCategoryKey(cat.id)}
                        className={
                          selected
                            ? "guide-reporter__chip guide-reporter__chip--selected"
                            : "guide-reporter__chip"
                        }
                      >
                        {cat.guestLabel}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label
                className="guide-reporter__field"
                htmlFor={summaryId}
              >
                <span className="guide-reporter__label">
                  Describe la incidencia
                </span>
                <textarea
                  id={summaryId}
                  className="guide-reporter__textarea"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  maxLength={SUMMARY_MAX}
                  required
                  placeholder="Ej: el wifi del salón no se conecta desde ayer por la tarde."
                  aria-describedby={`${summaryId}-counter`}
                />
                <span
                  id={`${summaryId}-counter`}
                  className="guide-reporter__counter"
                  aria-live="polite"
                >
                  {summaryRemaining} caracteres restantes
                </span>
              </label>

              <label
                className="guide-reporter__field"
                htmlFor={contactId}
              >
                <span className="guide-reporter__label">
                  Contacto (opcional)
                </span>
                <input
                  id={contactId}
                  type="text"
                  className="guide-reporter__input"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={CONTACT_MAX}
                  placeholder="Email, teléfono o WhatsApp"
                  autoComplete="off"
                />
                <span className="guide-reporter__hint">
                  Solo si quieres que el anfitrión pueda responderte
                  directamente.
                </span>
              </label>

              {state.kind === "error" && (
                <p className="guide-reporter__error" role="alert">
                  {state.message}
                </p>
              )}

              <div className="guide-reporter__actions">
                <Dialog.Close asChild>
                  <button type="button" className="guide-reporter__secondary">
                    Cancelar
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="guide-reporter__primary"
                  disabled={!canSubmit}
                  aria-disabled={!canSubmit}
                >
                  {state.kind === "loading" ? "Enviando…" : "Enviar aviso"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AlertIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1={12} y1={9} x2={12} y2={13} />
      <line x1={12} y1={17} x2={12.01} y2={17} />
    </svg>
  );
}
