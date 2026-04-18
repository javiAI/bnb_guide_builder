import { z } from "zod";
import { guideSections } from "@/lib/taxonomy-loader";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";
import { EMERGENCY_FIELD_LABELS } from "@/lib/types/guide-tree";

/** Discriminates how the client island handles the button click.
 *
 *  - `copy`    → writes `value` to the clipboard + shows a toast.
 *  - `tel`     → navigates to `tel:<value>` (native dialer).
 *  - `whatsapp`→ navigates to `https://wa.me/<e164-digits>` derived from `value`.
 *  - `maps`    → navigates to `value` (pre-built universal Google Maps URL).
 *  - `anchor`  → smooth-scrolls the in-page fragment `value` (starts with `#`).
 */
export const QUICK_ACTION_KINDS = [
  "copy",
  "tel",
  "whatsapp",
  "maps",
  "anchor",
] as const;
export type QuickActionKind = (typeof QUICK_ACTION_KINDS)[number];

const WIFI_PASSWORD_FIELD_LABEL = "Contraseña";
const LOCATION_ITEM_ID = "arrival.location";
const ACCESS_ITEM_ID = "arrival.access";

/** Minimal payload shipped from the server-rendered hero to the client island.
 * The resolver runs server-side against the normalized tree and returns `null`
 * when data is missing — the hero simply skips that button (graceful
 * degradation). */
export interface QuickActionResolved {
  id: string;
  label: string;
  ariaLabel: string;
  kind: QuickActionKind;
  /** Semantics depend on `kind` (see `QUICK_ACTION_KINDS` doc). */
  value: string;
  /** Toast message emitted after a successful `copy`. Ignored for other kinds. */
  toastOnSuccess?: string;
}

interface QuickAction {
  id: string;
  label: string;
  ariaLabel: string;
  kind: QuickActionKind;
  toastOnSuccess?: string;
  resolve(flat: GuideItem[]): QuickActionResolved | null;
}

function flattenItems(tree: GuideTree): GuideItem[] {
  const out: GuideItem[] = [];
  const walk = (items: GuideItem[]) => {
    for (const item of items) {
      out.push(item);
      walk(item.children);
    }
  };
  for (const section of tree.sections) walk(section.items);
  return out;
}

function findByTaxonomyKey(flat: GuideItem[], key: string): GuideItem | null {
  return flat.find((item) => item.taxonomyKey === key) ?? null;
}

function findById(flat: GuideItem[], id: string): GuideItem | null {
  return flat.find((item) => item.id === id) ?? null;
}

function findDisplayFieldValue(item: GuideItem, label: string): string | null {
  const field = item.displayFields?.find((f) => f.label === label);
  const value = field?.displayValue?.trim();
  return value ? value : null;
}

function resolveHostPhone(flat: GuideItem[]): string | null {
  const host = flat.find((item) => item.taxonomyKey === "ct.host");
  const hostPhone = host
    ? findDisplayFieldValue(host, EMERGENCY_FIELD_LABELS.phone)
    : null;
  if (hostPhone) return hostPhone;

  const cohost = flat.find((item) => item.taxonomyKey === "ct.cohost");
  return cohost
    ? findDisplayFieldValue(cohost, EMERGENCY_FIELD_LABELS.phone)
    : null;
}

function normalizePhoneForWhatsApp(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

const wifiCopy: QuickAction = {
  id: "wifi_copy",
  label: "Copiar Wi-Fi",
  ariaLabel: "Copiar contraseña del Wi-Fi",
  kind: "copy",
  toastOnSuccess: "Contraseña copiada",
  resolve(flat) {
    const wifi = findByTaxonomyKey(flat, "am.wifi");
    if (!wifi) return null;
    const password = findDisplayFieldValue(wifi, WIFI_PASSWORD_FIELD_LABEL);
    if (!password) return null;
    return {
      id: this.id,
      label: this.label,
      ariaLabel: this.ariaLabel,
      kind: this.kind,
      value: password,
      toastOnSuccess: this.toastOnSuccess,
    };
  },
};

const callHost: QuickAction = {
  id: "call_host",
  label: "Llamar anfitrión",
  ariaLabel: "Llamar al anfitrión",
  kind: "tel",
  resolve(flat) {
    const phone = resolveHostPhone(flat);
    if (!phone) return null;
    return {
      id: this.id,
      label: this.label,
      ariaLabel: this.ariaLabel,
      kind: this.kind,
      value: phone,
    };
  },
};

const whatsappHost: QuickAction = {
  id: "whatsapp_host",
  label: "WhatsApp",
  ariaLabel: "Enviar WhatsApp al anfitrión",
  kind: "whatsapp",
  resolve(flat) {
    const phone = resolveHostPhone(flat);
    if (!phone) return null;
    const digits = normalizePhoneForWhatsApp(phone);
    if (!digits) return null;
    return {
      id: this.id,
      label: this.label,
      ariaLabel: this.ariaLabel,
      kind: this.kind,
      value: digits,
    };
  },
};

const mapsOpen: QuickAction = {
  id: "maps_open",
  label: "Abrir en Maps",
  ariaLabel: "Abrir la dirección en Maps",
  kind: "maps",
  resolve(flat) {
    const item = findById(flat, LOCATION_ITEM_ID);
    const address = item?.displayValue?.trim();
    if (!address) return null;
    const url =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(address);
    return {
      id: this.id,
      label: this.label,
      ariaLabel: this.ariaLabel,
      kind: this.kind,
      value: url,
    };
  },
};

const accessHow: QuickAction = {
  id: "access_how",
  label: "Cómo entrar",
  ariaLabel: "Ir a las instrucciones de entrada",
  kind: "anchor",
  resolve(flat) {
    const access = findById(flat, ACCESS_ITEM_ID);
    if (!access) return null;
    return {
      id: this.id,
      label: this.label,
      ariaLabel: this.ariaLabel,
      kind: this.kind,
      value: `#item-${ACCESS_ITEM_ID}`,
    };
  },
};

const QUICK_ACTIONS: Record<string, QuickAction> = {
  wifi_copy: wifiCopy,
  call_host: callHost,
  whatsapp_host: whatsappHost,
  maps_open: mapsOpen,
  access_how: accessHow,
};

export function listQuickActionIds(): ReadonlyArray<string> {
  return Object.keys(QUICK_ACTIONS);
}

/** Resolves the ordered list of quick-action keys declared on a section
 * against the tree. Returns only the actions whose data is available. */
export function resolveQuickActions(
  keys: ReadonlyArray<string>,
  tree: GuideTree,
): QuickActionResolved[] {
  const flat = flattenItems(tree);
  const out: QuickActionResolved[] = [];
  for (const key of keys) {
    const action = QUICK_ACTIONS[key];
    if (!action) continue;
    const resolved = action.resolve(flat);
    if (resolved) out.push(resolved);
  }
  return out;
}

// ── Boot validation ─────────────────────────────────────────────────────────
// Zod shape for the already-parsed registry entry. Enforced at module load so
// a malformed registry is a boot error, not a runtime surprise.
const QuickActionInternalSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  ariaLabel: z.string().min(1),
  kind: z.enum(QUICK_ACTION_KINDS),
  toastOnSuccess: z.string().min(1).optional(),
  resolve: z
    .unknown()
    .refine((v): v is QuickAction["resolve"] => typeof v === "function"),
});

function validateRegistry(): void {
  for (const [key, action] of Object.entries(QUICK_ACTIONS)) {
    const parsed = QuickActionInternalSchema.safeParse(action);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("\n");
      throw new Error(
        `[quick-action-registry] Invalid entry "${key}":\n${details}`,
      );
    }
    if (action.id !== key) {
      throw new Error(
        `[quick-action-registry] Entry "${key}" has mismatched id "${action.id}".`,
      );
    }
    if (action.kind === "copy" && !action.toastOnSuccess) {
      throw new Error(
        `[quick-action-registry] Entry "${key}" with kind=copy requires toastOnSuccess.`,
      );
    }
  }
}

function validateSectionReferences(): void {
  const registered = new Set(Object.keys(QUICK_ACTIONS));
  for (const section of guideSections.items) {
    if (!section.quickActionKeys) continue;
    const seen = new Set<string>();
    for (const key of section.quickActionKeys) {
      if (!registered.has(key)) {
        throw new Error(
          `[quick-action-registry] Unknown quickActionKey "${key}" in section "${section.id}". ` +
            `Registered: ${Array.from(registered).join(", ")}.`,
        );
      }
      if (seen.has(key)) {
        throw new Error(
          `[quick-action-registry] Duplicate quickActionKey "${key}" in section "${section.id}".`,
        );
      }
      seen.add(key);
    }
  }
}

validateRegistry();
validateSectionReferences();
