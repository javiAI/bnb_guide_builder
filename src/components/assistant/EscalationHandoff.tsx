"use client";

import type { EscalationResolutionDTO } from "@/lib/schemas/assistant.schema";
import type { ContactChannel } from "@/lib/contact-actions";

interface Props {
  handoff: EscalationResolutionDTO;
}

const FALLBACK_COPY: Record<EscalationResolutionDTO["fallbackLevel"], string> = {
  intent: "Contacto específico para esta incidencia.",
  intent_with_host:
    "Sin contacto específico configurado — derivando al anfitrión.",
  fallback: "Fallback general — no hay contacto específico disponible.",
};

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  tel: "Llamar",
  whatsapp: "WhatsApp",
  email: "Correo",
};

const CHANNEL_ACTION: Record<ContactChannel, string> = {
  tel: "Llamar a",
  whatsapp: "Abrir WhatsApp con",
  email: "Enviar correo a",
};

export function EscalationHandoff({ handoff }: Props) {
  const emergency = handoff.emergencyPriority;
  return (
    <article
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-3"
      data-escalation-intent={handoff.intentId}
      data-emergency={emergency ? "true" : "false"}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={
            emergency
              ? "rounded-full bg-[var(--color-status-error-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-status-error-text)]"
              : "rounded-full bg-[var(--color-action-primary-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-action-primary-subtle-fg)]"
          }
        >
          {emergency ? "Emergencia" : "Contacto"}
        </span>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {handoff.intentLabel}
        </h4>
      </header>

      <p className="text-xs text-[var(--color-text-secondary)]">
        {FALLBACK_COPY[handoff.fallbackLevel]}
      </p>

      {handoff.contacts.length === 0 ? (
        <p className="text-xs italic text-[var(--color-text-muted)]">
          No se encontraron contactos alcanzables para esta propiedad.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {handoff.contacts.map((c) => (
            <li
              key={c.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-page)] p-2"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <strong className="text-sm text-[var(--color-text-primary)]">
                  {c.displayName}
                </strong>
                {c.isPrimary && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    Principal
                  </span>
                )}
                {c.emergencyAvailable && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-status-error-text)]">
                    24/7
                  </span>
                )}
              </div>
              {c.notes && (
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {c.notes}
                </p>
              )}
              {c.channels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.channels.map((ch) => (
                    <a
                      key={ch.kind}
                      href={ch.href}
                      aria-label={`${CHANNEL_ACTION[ch.kind]} ${c.displayName}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-3 py-2 text-xs font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
                    >
                      {CHANNEL_LABEL[ch.kind]}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
