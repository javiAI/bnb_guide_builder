import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { buildMailtoHref, buildTelHref, buildWhatsAppHref } from "@/lib/contact-actions";

/**
 * Read-only quick actions for a contact card (kit `cn-actions`). Each action is
 * a <ButtonLink size="md"> (44 visual) — "Llamar" primary, the rest secondary.
 * Anchors are derived from the contact's own fields (via the shared
 * `contact-actions` helpers) and omitted when the field is absent (or, for
 * WhatsApp, when the number is not international).
 */
export interface ContactQuickActionsProps {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
}

function telHref(raw: string | null): string | null {
  return raw?.trim() ? buildTelHref(raw) : null;
}

/** WhatsApp only works with an international number; require a leading "+",
 *  then let the shared helper normalize/validate the digits. */
function waHref(raw: string | null): string | null {
  return raw?.trim().startsWith("+") ? buildWhatsAppHref(raw) : null;
}

function mapsHref(address: string | null): string | null {
  if (!address || !address.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

const ACTION_CLASS = "grow justify-center";

export function ContactQuickActions({
  phone,
  email,
  whatsapp,
  address,
}: ContactQuickActionsProps) {
  const tel = telHref(phone);
  const wa = waHref(whatsapp) ?? waHref(phone);
  const mail = email ? buildMailtoHref(email) : null;
  const maps = mapsHref(address);

  if (!tel && !wa && !mail && !maps) return null;

  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-1">
      {tel && (
        <ButtonLink href={tel} variant="primary" size="md" className={ACTION_CLASS}>
          <Phone size={14} aria-hidden="true" />
          Llamar
        </ButtonLink>
      )}
      {wa && (
        <ButtonLink
          href={wa}
          variant="secondary"
          size="md"
          className={ACTION_CLASS}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={14} aria-hidden="true" />
          WhatsApp
        </ButtonLink>
      )}
      {mail && (
        <ButtonLink href={mail} variant="secondary" size="md" className={ACTION_CLASS}>
          <Mail size={14} aria-hidden="true" />
          Email
        </ButtonLink>
      )}
      {maps && (
        <ButtonLink
          href={maps}
          variant="secondary"
          size="md"
          className={ACTION_CLASS}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin size={14} aria-hidden="true" />
          Ir
        </ButtonLink>
      )}
    </div>
  );
}
