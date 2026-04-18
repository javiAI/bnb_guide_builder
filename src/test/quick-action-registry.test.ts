import { describe, it, expect } from "vitest";
import {
  listQuickActionIds,
  resolveQuickActions,
} from "@/config/registries/quick-action-registry";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";

function item(partial: Partial<GuideItem> & Pick<GuideItem, "id" | "label">): GuideItem {
  return {
    taxonomyKey: null,
    value: null,
    visibility: "guest",
    deprecated: false,
    warnings: [],
    fields: [],
    media: [],
    children: [],
    ...partial,
  };
}

function treeWith(options: {
  wifiPassword?: string;
  hostPhone?: string;
  cohostPhone?: string;
  address?: string;
  includeAccessItem?: boolean;
}): GuideTree {
  const sections: GuideTree["sections"] = [];

  const essentials: GuideItem[] = [];
  if (options.wifiPassword) {
    essentials.push(
      item({
        id: "essentials.amenities.am.wifi",
        taxonomyKey: "am.wifi",
        label: "Wi-Fi",
        displayFields: [
          { label: "Contraseña", displayValue: options.wifiPassword, visibility: "guest" },
        ],
      }),
    );
  }
  if (options.address) {
    essentials.push(
      item({
        id: "arrival.location",
        label: "Ubicación",
        value: options.address,
        displayValue: options.address,
      }),
    );
  }
  if (options.includeAccessItem) {
    essentials.push(
      item({
        id: "arrival.access",
        taxonomyKey: "am.smartlock",
        label: "Cómo entrar",
        displayValue: "Código 1234",
      }),
    );
  }
  if (essentials.length > 0) {
    sections.push({
      id: "gs.essentials",
      label: "Esenciales",
      order: 5,
      resolverKey: "essentials",
      sortBy: "explicit_order",
      emptyCtaDeepLink: null,
      maxVisibility: "internal",
      items: essentials,
      isHero: true,
      isAggregator: true,
      sourceResolverKeys: ["arrival", "amenities", "rules"],
    });
  }

  const contacts: GuideItem[] = [];
  if (options.hostPhone) {
    contacts.push(
      item({
        id: "ct.host.1",
        taxonomyKey: "ct.host",
        label: "Anfitrión",
        displayFields: [
          { label: "Teléfono", displayValue: options.hostPhone, visibility: "guest" },
        ],
      }),
    );
  }
  if (options.cohostPhone) {
    contacts.push(
      item({
        id: "ct.cohost.1",
        taxonomyKey: "ct.cohost",
        label: "Co-anfitrión",
        displayFields: [
          { label: "Teléfono", displayValue: options.cohostPhone, visibility: "guest" },
        ],
      }),
    );
  }
  if (contacts.length > 0) {
    sections.push({
      id: "gs.emergency",
      label: "Ayuda",
      order: 70,
      resolverKey: "emergency",
      sortBy: "explicit_order",
      emptyCtaDeepLink: null,
      maxVisibility: "internal",
      items: contacts,
    });
  }

  return {
    schemaVersion: 3,
    propertyId: "p1",
    audience: "guest",
    generatedAt: "2026-04-18T00:00:00.000Z",
    sections,
  };
}

const ALL_KEYS = [
  "wifi_copy",
  "call_host",
  "whatsapp_host",
  "maps_open",
  "access_how",
] as const;

describe("quick-action-registry", () => {
  it("registers the 5 expected actions", () => {
    expect(listQuickActionIds()).toEqual(expect.arrayContaining([...ALL_KEYS]));
  });

  it("wifi_copy resolves password from am.wifi displayField Contraseña", () => {
    const tree = treeWith({ wifiPassword: "welcome2026" });
    const [a] = resolveQuickActions(["wifi_copy"], tree);
    expect(a).toMatchObject({
      id: "wifi_copy",
      kind: "copy",
      value: "welcome2026",
      toastOnSuccess: "Contraseña copiada",
    });
  });

  it("wifi_copy is omitted when am.wifi is missing", () => {
    const tree = treeWith({});
    expect(resolveQuickActions(["wifi_copy"], tree)).toHaveLength(0);
  });

  it("wifi_copy is omitted when the password field is blank", () => {
    const tree = treeWith({ wifiPassword: "   " });
    expect(resolveQuickActions(["wifi_copy"], tree)).toHaveLength(0);
  });

  it("call_host picks ct.host phone when present", () => {
    const tree = treeWith({ hostPhone: "+34 600 000 000" });
    const [a] = resolveQuickActions(["call_host"], tree);
    expect(a).toMatchObject({
      id: "call_host",
      kind: "tel",
      value: "+34 600 000 000",
    });
  });

  it("call_host falls back to ct.cohost when ct.host is missing", () => {
    const tree = treeWith({ cohostPhone: "+34 611 111 111" });
    const [a] = resolveQuickActions(["call_host"], tree);
    expect(a?.value).toBe("+34 611 111 111");
  });

  it("whatsapp_host strips non-digits from phone", () => {
    const tree = treeWith({ hostPhone: "+34 600-111 222" });
    const [a] = resolveQuickActions(["whatsapp_host"], tree);
    expect(a).toMatchObject({
      id: "whatsapp_host",
      kind: "whatsapp",
      value: "34600111222",
    });
  });

  it("whatsapp_host is omitted for nonsensical phones", () => {
    const tree = treeWith({ hostPhone: "abc" });
    expect(resolveQuickActions(["whatsapp_host"], tree)).toHaveLength(0);
  });

  it("maps_open returns a universal google maps URL", () => {
    const tree = treeWith({ address: "Calle Mayor 12, 28013 Madrid" });
    const [a] = resolveQuickActions(["maps_open"], tree);
    expect(a?.kind).toBe("maps");
    expect(a?.value).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(a?.value).toContain(encodeURIComponent("Calle Mayor 12, 28013 Madrid"));
  });

  it("maps_open is omitted when no address is present", () => {
    const tree = treeWith({});
    expect(resolveQuickActions(["maps_open"], tree)).toHaveLength(0);
  });

  it("access_how returns anchor to arrival.access", () => {
    const tree = treeWith({ includeAccessItem: true });
    const [a] = resolveQuickActions(["access_how"], tree);
    expect(a).toMatchObject({
      id: "access_how",
      kind: "anchor",
      value: "#item-arrival.access",
    });
  });

  it("access_how is omitted when no access item exists", () => {
    const tree = treeWith({});
    expect(resolveQuickActions(["access_how"], tree)).toHaveLength(0);
  });

  it("preserves order from the input keys array", () => {
    const tree = treeWith({
      wifiPassword: "abc",
      hostPhone: "+34 600 000 000",
      address: "Plaza Mayor, Madrid",
      includeAccessItem: true,
    });
    const actions = resolveQuickActions(
      ["maps_open", "wifi_copy", "call_host", "access_how"],
      tree,
    );
    expect(actions.map((a) => a.id)).toEqual([
      "maps_open",
      "wifi_copy",
      "call_host",
      "access_how",
    ]);
  });

  it("skips unknown keys silently", () => {
    const tree = treeWith({ wifiPassword: "abc" });
    const actions = resolveQuickActions(
      ["wifi_copy", "nonexistent_action"],
      tree,
    );
    expect(actions.map((a) => a.id)).toEqual(["wifi_copy"]);
  });
});
