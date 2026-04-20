// Structural invariants of taxonomies/messaging_variables.json and the
// resolver registry. Covers:
// - Zod schema at boot: catalog is parsed (import succeeds without throwing).
// - Every item uses a registered source.kind.
// - Every knowledge_item topic has either a canonical renderer or a KI
//   fallback filter declared in the service.
// - Property paths used by property_field are in the allowlist.
// - Contact field projections match the ContactRow shape.
// - Reservation items always declare previewBehavior=placeholder.
// - Groups: referential integrity + unique ids.
// - Unknown variable validation + describeUnknownVariable formatting.

import { describe, it, expect } from "vitest";
import {
  messagingVariables,
  messagingVariablesByToken,
  KNOWN_MESSAGING_VARIABLES,
  MV_SOURCE_KINDS,
  MV_SEND_POLICIES,
  MV_PREVIEW_BEHAVIORS,
  type MessagingVariableItem,
} from "@/lib/taxonomy-loader";
import {
  validateVariables,
  describeUnknownVariable,
} from "@/lib/schemas/messaging.schema";
import {
  RESOLVERS,
  PROPERTY_FIELD_ALLOWLIST,
} from "@/lib/services/messaging-variables-resolvers";

// ── Catalog integrity ──

describe("messaging_variables.json — catalog integrity", () => {
  it("catalog loads (Zod validation at import time)", () => {
    expect(messagingVariables.items.length).toBeGreaterThan(0);
    expect(messagingVariables.groups.length).toBeGreaterThan(0);
  });

  it("file + locale metadata are declared", () => {
    expect(messagingVariables.file).toBe("messaging_variables.json");
    expect(messagingVariables.locale).toBe("es");
  });

  it("every item.group references an existing group entry", () => {
    const groupIds = new Set(messagingVariables.groups.map((g) => g.id));
    for (const item of messagingVariables.items) {
      expect(groupIds.has(item.group)).toBe(true);
    }
  });

  it("item ids and variables are unique", () => {
    const ids = messagingVariables.items.map((i) => i.id);
    const variables = messagingVariables.items.map((i) => i.variable);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(variables).size).toBe(variables.length);
  });

  it("messagingVariablesByToken is in sync with the catalog", () => {
    expect(messagingVariablesByToken.size).toBe(messagingVariables.items.length);
    for (const item of messagingVariables.items) {
      expect(messagingVariablesByToken.get(item.variable)).toBe(item);
    }
  });

  it("KNOWN_MESSAGING_VARIABLES is in sync with the catalog", () => {
    expect(KNOWN_MESSAGING_VARIABLES.size).toBe(messagingVariables.items.length);
    for (const item of messagingVariables.items) {
      expect(KNOWN_MESSAGING_VARIABLES.has(item.variable)).toBe(true);
    }
  });
});

// ── source.kind coverage ──

describe("messaging_variables.json — source.kind coverage", () => {
  it("every item.source.kind is in the registered MV_SOURCE_KINDS set", () => {
    const allowed = new Set<string>(MV_SOURCE_KINDS);
    for (const item of messagingVariables.items) {
      expect(allowed.has(item.source.kind)).toBe(true);
    }
  });

  it("every registered source.kind has a resolver", () => {
    for (const kind of MV_SOURCE_KINDS) {
      expect(RESOLVERS[kind]).toBeDefined();
      expect(typeof RESOLVERS[kind]).toBe("function");
    }
  });

  it("at least one item exists per group (property, contact, operations, reservation)", () => {
    const groups = new Set(messagingVariables.items.map((i) => i.group));
    expect(groups.has("property")).toBe(true);
    expect(groups.has("contact")).toBe(true);
    expect(groups.has("operations")).toBe(true);
    expect(groups.has("reservation")).toBe(true);
  });
});

// ── Per-source-kind invariants ──

describe("messaging_variables.json — per-source-kind invariants", () => {
  const CONTACT_FIELDS = new Set(["displayName", "phone", "whatsapp", "email"]);

  it("property_field: path is in the resolver allowlist", () => {
    const items = messagingVariables.items.filter(
      (i) => i.source.kind === "property_field",
    );
    for (const item of items) {
      if (item.source.kind !== "property_field") continue;
      expect(PROPERTY_FIELD_ALLOWLIST.has(item.source.path)).toBe(true);
    }
  });

  it("contact: field projection is valid and fallback chain has no duplicates", () => {
    const items = messagingVariables.items.filter(
      (i) => i.source.kind === "contact",
    );
    for (const item of items) {
      if (item.source.kind !== "contact") continue;
      expect(CONTACT_FIELDS.has(item.source.field)).toBe(true);
      const chain = [
        item.source.roleKey,
        ...(item.source.fallbackRoleKeys ?? []),
      ];
      expect(new Set(chain).size).toBe(chain.length);
      for (const role of chain) {
        expect(role.startsWith("ct.")).toBe(true);
      }
    }
  });

  it("reservation: previewBehavior is always 'placeholder' (12A contract)", () => {
    const items = messagingVariables.items.filter(
      (i) => i.source.kind === "reservation",
    );
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.previewBehavior).toBe("placeholder");
    }
  });

  it("non-reservation items can use either previewBehavior (but 'resolve' is expected for most)", () => {
    const nonReservation = messagingVariables.items.filter(
      (i) => i.source.kind !== "reservation",
    );
    for (const item of nonReservation) {
      expect(MV_PREVIEW_BEHAVIORS).toContain(item.previewBehavior);
    }
  });

  it("sendPolicy is within the declared union", () => {
    for (const item of messagingVariables.items) {
      expect(MV_SEND_POLICIES).toContain(item.sendPolicy);
    }
  });

  it("derived: derivation values are known to the resolver (currently: guide_url)", () => {
    const DERIVATIONS = new Set(["guide_url"]);
    const items = messagingVariables.items.filter(
      (i) => i.source.kind === "derived",
    );
    for (const item of items) {
      if (item.source.kind !== "derived") continue;
      expect(DERIVATIONS.has(item.source.derivation)).toBe(true);
    }
  });
});

// ── knowledge_item topic coverage ──

describe("messaging_variables.json — knowledge_item topics", () => {
  it("every KI topic is either in the canonical renderer map or has a KI fallback filter", () => {
    // Mirror the topic lists from messaging-variables-resolvers.ts and
    // messaging-variables.service.ts. If the service adds a topic, this test
    // keeps the taxonomy and resolver in sync.
    const CANONICAL_TOPICS = new Set([
      "wifi_name",
      "wifi_password",
      "smoking_policy",
      "pet_policy",
      "access_instructions",
      "parking_instructions",
    ]);

    const items = messagingVariables.items.filter(
      (i) => i.source.kind === "knowledge_item",
    );
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      if (item.source.kind !== "knowledge_item") continue;
      expect(CANONICAL_TOPICS.has(item.source.topic)).toBe(true);
    }
  });
});

// ── validateVariables + describeUnknownVariable ──

describe("validateVariables / describeUnknownVariable", () => {
  it("reports each unknown token with a suggestion when close enough", () => {
    const result = validateVariables("{{guest_nmae}} {{property_name}}");
    expect(result.valid).toEqual(["property_name"]);
    expect(result.unknown).toHaveLength(1);
    expect(result.unknown[0]).toEqual({
      token: "guest_nmae",
      suggestion: "guest_name",
    });
  });

  it("describeUnknownVariable formats the Spanish message with suggestion", () => {
    const msg = describeUnknownVariable({
      token: "guest_nmae",
      suggestion: "guest_name",
    });
    expect(msg).toBe(
      "Variable desconocida {{guest_nmae}}. ¿Quisiste decir {{guest_name}}?",
    );
  });

  it("describeUnknownVariable omits the suggestion when null", () => {
    const msg = describeUnknownVariable({
      token: "zzz_whatever",
      suggestion: null,
    });
    expect(msg).toBe("Variable desconocida {{zzz_whatever}}.");
  });

  it("returns empty valid/unknown for a plain-text body", () => {
    const result = validateVariables("Hola, bienvenido.");
    expect(result.valid).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it("every catalog item is recognised as valid by validateVariables", () => {
    const body = messagingVariables.items
      .map((i: MessagingVariableItem) => `{{${i.variable}}}`)
      .join(" ");
    const result = validateVariables(body);
    expect(result.unknown).toEqual([]);
    expect(result.valid.sort()).toEqual(
      messagingVariables.items.map((i) => i.variable).sort(),
    );
  });
});
