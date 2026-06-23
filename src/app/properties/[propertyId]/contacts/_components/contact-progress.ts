import type { EntityCardStatus } from "@/components/ui/entity-media-card";

// Honest binary status for a contact card (precedent: Acceso's
// configured/pending). A contact is "complete" once it has at least one way to
// reach it — a phone, a WhatsApp or an email. `address`/`phoneSecondary` are
// useful extras but don't, on their own, make the contact actionable, so they
// never count as a channel. No invented `partial`. Pure (no React) so it runs
// identically on the server aggregate and the live card.

export type ContactStatus = Extract<EntityCardStatus, "complete" | "empty">;

interface ContactChannels {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

function hasValue(v: string | null): boolean {
  return v != null && v.trim() !== "";
}

/** Complete ⇔ at least one reachable channel (phone | whatsapp | email). */
export function computeContactStatus(c: ContactChannels): ContactStatus {
  return hasValue(c.phone) || hasValue(c.whatsapp) || hasValue(c.email)
    ? "complete"
    : "empty";
}

/** The unmet signal behind a non-complete status, as an operator-facing label
 *  surfaced on the status pill's hover. Mirrors computeContactStatus exactly. */
export function missingContactSignals(c: ContactChannels): string[] {
  return computeContactStatus(c) === "complete"
    ? []
    : ["un canal de contacto (teléfono, WhatsApp o email)"];
}

export const STATUS_LABEL: Record<ContactStatus, string> = {
  complete: "Completo",
  empty: "Pendiente",
};
