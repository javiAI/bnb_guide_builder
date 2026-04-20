// Server and client both import this module — keep it React-free and
// side-effect-free.

export const CONTACT_CHANNELS = ["tel", "whatsapp", "email"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

const WHATSAPP_MIN_DIGITS = 7;
const WHATSAPP_MAX_DIGITS = 15;

/** Digits-only E.164-ish form accepted by wa.me. Returns null if the input
 *  can't produce a usable number (too few or too many digits). */
export function normalizePhoneForWhatsApp(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < WHATSAPP_MIN_DIGITS || digits.length > WHATSAPP_MAX_DIGITS) {
    return null;
  }
  return digits;
}

/** `tel:` URIs accept `+` and digits; native dialers tolerate spaces but
 *  stripping them avoids flaky parsing on older Android browsers. */
export function buildTelHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

/** Returns null when the phone can't be normalized to wa.me format. The
 *  caller decides whether to fall back to another channel or hide the CTA. */
export function buildWhatsAppHref(phone: string): string | null {
  const digits = normalizePhoneForWhatsApp(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

/** Trims whitespace and returns null for empty inputs so the caller can
 *  decide whether to render the link or hide it. We don't validate address
 *  shape — `mailto:` tolerates malformed inputs and the browser surfaces the
 *  error, which is more useful than silently dropping the link. */
export function buildMailtoHref(email: string): string | null {
  const trimmed = email.trim();
  return trimmed ? `mailto:${trimmed}` : null;
}
