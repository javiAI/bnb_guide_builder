// Happy-path resolution: fixture property with data for every non-reservation
// source.kind. Exercises property_field (incl. checkInWindow composition),
// derived guide_url, contact with fallback chain, and knowledge_item canonical
// renderers (wifi_*, pet_policy, smoking_policy, access_instructions,
// parking_instructions). Reservation group stays `unresolved_context`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { propertyMock, contactMock, amenityMock, knowledgeMock } = vi.hoisted(
  () => ({
    propertyMock: vi.fn<(args: unknown) => Promise<unknown>>(),
    contactMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    amenityMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    knowledgeMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUniqueOrThrow: propertyMock },
    contact: { findMany: contactMock },
    propertyAmenityInstance: { findMany: amenityMock },
    knowledgeItem: { findMany: knowledgeMock },
  },
}));

import { resolveVariables } from "@/lib/services/messaging-variables.service";

// ── Fixture property with every resolvable variable populated ──

const FIXTURE_PROPERTY = {
  id: "prop_1",
  propertyNickname: "Ático Malasaña",
  propertyType: "apartment",
  checkInStart: "16:00",
  checkInEnd: "20:00",
  checkOutTime: "11:00",
  city: "Madrid",
  country: "España",
  timezone: "Europe/Madrid",
  streetAddress: "Calle Fuencarral 123, 3ºB",
  maxGuests: 4,
  publicSlug: "atico-malasana",
  accessMethodsJson: [
    {
      method: "smart_lock",
      instructions: "Código 2024* en la cerradura principal.",
    },
  ],
  policiesJson: {
    smoking: "outdoors_only",
    pets: {
      allowed: true,
      types: ["perros"],
      maxCount: 1,
      notes: "Con cargo de 15€/noche.",
    },
  },
  customAccessMethodDesc: null,
  primaryAccessMethod: "smart_lock",
  defaultLocale: "es",
};

const FIXTURE_CONTACTS = [
  {
    id: "c_host",
    roleKey: "ct.host",
    displayName: "Marta García",
    phone: "+34 600 000 001",
    whatsapp: "+34 600 000 001",
    email: "marta@example.com",
    visibility: "internal",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "c_pm",
    roleKey: "ct.property_manager",
    displayName: "Luis PM",
    phone: "+34 600 123 456",
    whatsapp: "+34 600 123 456",
    email: null,
    visibility: "internal",
    isPrimary: true,
    sortOrder: 0,
  },
];

const FIXTURE_AMENITIES = [
  {
    id: "a_wifi",
    amenityKey: "am.wifi",
    guestInstructions: null,
    detailsJson: { ssid: "Atico-Guest", password: "bienvenidos2026" },
    visibility: "internal",
  },
  {
    id: "a_parking",
    amenityKey: "am.parking",
    guestInstructions: "Parking público a 100m en Plaza Mayor.",
    detailsJson: null,
    visibility: "guest",
  },
];

beforeEach(() => {
  propertyMock.mockReset();
  contactMock.mockReset();
  amenityMock.mockReset();
  knowledgeMock.mockReset();

  propertyMock.mockResolvedValue(FIXTURE_PROPERTY);
  contactMock.mockResolvedValue(FIXTURE_CONTACTS);
  amenityMock.mockResolvedValue(FIXTURE_AMENITIES);
  knowledgeMock.mockResolvedValue([]);
});

// ── Tests ──

describe("resolveVariables — happy path", () => {
  it("resolves every non-reservation variable against the fixture property", async () => {
    const body = [
      "{{property_name}}",
      "{{check_in_time}}",
      "{{check_in_window}}",
      "{{check_out_time}}",
      "{{city}}",
      "{{country}}",
      "{{timezone}}",
      "{{street_address}}",
      "{{max_guests}}",
      "{{guide_url}}",
      "{{host_name}}",
      "{{support_contact_phone}}",
      "{{support_contact_whatsapp}}",
      "{{wifi_name}}",
      "{{wifi_password}}",
      "{{access_instructions}}",
      "{{pet_policy}}",
      "{{smoking_policy}}",
      "{{parking_instructions}}",
    ].join("\n");

    const result = await resolveVariables("prop_1", body);

    expect(result.unknown).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.unresolvedContext).toEqual([]);

    // Exact values (sanity-check a few — all presenters pure & deterministic).
    expect(result.states.property_name).toEqual({
      status: "resolved",
      value: "Ático Malasaña",
      sourceUsed: "canonical",
    });
    expect(result.states.check_in_window).toEqual({
      status: "resolved",
      value: "16:00–20:00",
      sourceUsed: "canonical",
    });
    expect(result.states.max_guests).toEqual({
      status: "resolved",
      value: "4",
      sourceUsed: "canonical",
    });
    expect(result.states.guide_url).toEqual({
      status: "resolved",
      value: "/g/atico-malasana",
      sourceUsed: "derived",
    });

    // Contact falls back through property_manager → primary contact picked.
    expect(result.states.support_contact_phone).toMatchObject({
      status: "resolved",
      value: "+34 600 123 456",
      sourceUsed: "contact",
    });
    // host_name resolves from ct.host directly.
    expect(result.states.host_name).toMatchObject({
      status: "resolved",
      value: "Marta García",
      sourceUsed: "contact",
    });

    // Canonical P3 — wifi from amenity detailsJson (no KI fallback for short
    // values).
    expect(result.states.wifi_name).toMatchObject({
      status: "resolved",
      value: "Atico-Guest",
      sourceUsed: "canonical",
    });
    expect(result.states.wifi_password).toMatchObject({
      status: "resolved",
      value: "bienvenidos2026",
      sourceUsed: "canonical",
    });

    // Smoking: enum → ES label.
    expect(result.states.smoking_policy).toMatchObject({
      status: "resolved",
      value: "Solo se permite fumar en zonas exteriores.",
      sourceUsed: "canonical",
    });

    // Pet: rendered sentence includes property name + note.
    expect(result.states.pet_policy).toMatchObject({
      status: "resolved",
      sourceUsed: "canonical",
    });
    const petValue =
      result.states.pet_policy.status === "resolved"
        ? result.states.pet_policy.value
        : "";
    expect(petValue).toContain("perros");
    expect(petValue).toContain("Ático Malasaña");
    expect(petValue).toContain("15€/noche");

    // Access: accessMethodsJson entries joined.
    expect(result.states.access_instructions).toMatchObject({
      status: "resolved",
      value: "Código 2024* en la cerradura principal.",
      sourceUsed: "canonical",
    });

    // Parking: amenity guestInstructions.
    expect(result.states.parking_instructions).toMatchObject({
      status: "resolved",
      value: "Parking público a 100m en Plaza Mayor.",
      sourceUsed: "canonical",
    });

    // Output does not contain any leftover `{{var}}` tokens.
    expect(result.output).not.toMatch(/\{\{[a-z_]+\}\}/);
  });

  it("builds absolute guide_url when guideBaseUrl option is provided", async () => {
    const result = await resolveVariables("prop_1", "Ver {{guide_url}}", {
      guideBaseUrl: "https://app.example.com/",
    });
    expect(result.states.guide_url).toEqual({
      status: "resolved",
      value: "https://app.example.com/g/atico-malasana",
      sourceUsed: "derived",
    });
  });

  it("leaves reservation variables as unresolved_context (placeholder render)", async () => {
    const body = "Hola {{guest_name}}, check-in {{check_in_date}}.";
    const result = await resolveVariables("prop_1", body);

    expect(result.unresolvedContext).toEqual([
      "guest_name",
      "check_in_date",
    ]);
    expect(result.states.guest_name).toEqual({
      status: "unresolved_context",
      label: "Nombre del huésped",
    });
    // Rendered as `[Label]` placeholder — NOT `[Falta: Label]`.
    expect(result.output).toBe(
      "Hola [Nombre del huésped], check-in [Fecha de check-in].",
    );
  });

  it("short-circuits DB calls when template has no variables", async () => {
    const result = await resolveVariables("prop_1", "Hola, bienvenido.");
    expect(result.output).toBe("Hola, bienvenido.");
    expect(result.states).toEqual({});
    expect(propertyMock).not.toHaveBeenCalled();
    expect(contactMock).not.toHaveBeenCalled();
    expect(amenityMock).not.toHaveBeenCalled();
    expect(knowledgeMock).not.toHaveBeenCalled();
  });
});

describe("resolveVariables — canonical > knowledge_item priority", () => {
  it("prefers canonical amenity data over KnowledgeItem when both exist", async () => {
    // pet_policy has both canonical (policiesJson) and KI fallback. Here we
    // provide BOTH and expect canonical to win.
    knowledgeMock.mockResolvedValueOnce([
      {
        id: "ki_pet",
        bodyMd: "KI-fallback pet policy text.",
        entityType: "policy",
        templateKey: "pets",
        tags: [],
        visibility: "internal",
        confidenceScore: 0.9,
      },
    ]);

    const result = await resolveVariables("prop_1", "{{pet_policy}}");
    expect(result.states.pet_policy).toMatchObject({
      status: "resolved",
      sourceUsed: "canonical",
    });
    if (result.states.pet_policy.status === "resolved") {
      expect(result.states.pet_policy.value).not.toContain("KI-fallback");
      expect(result.states.pet_policy.value).toContain("perros");
    }
  });

  it("uses KnowledgeItem fallback when canonical source is empty (non-short values)", async () => {
    // Strip the canonical pet policy from the fixture property.
    propertyMock.mockResolvedValueOnce({
      ...FIXTURE_PROPERTY,
      policiesJson: {},
    });
    knowledgeMock.mockResolvedValueOnce([
      {
        id: "ki_pet",
        bodyMd: "KI-fallback pet policy text.",
        entityType: "policy",
        templateKey: "pets",
        tags: [],
        visibility: "internal",
        confidenceScore: 0.9,
      },
    ]);

    const result = await resolveVariables("prop_1", "{{pet_policy}}");
    expect(result.states.pet_policy).toEqual({
      status: "resolved",
      value: "KI-fallback pet policy text.",
      sourceUsed: "knowledge_item",
    });
  });

  it("short-value variables (wifi_*) never use KI fallback — missing if canonical empty", async () => {
    // am.wifi amenity present but with empty detailsJson → canonical empty.
    amenityMock.mockResolvedValueOnce([
      {
        id: "a_wifi",
        amenityKey: "am.wifi",
        guestInstructions: null,
        detailsJson: {},
        visibility: "internal",
      },
    ]);
    knowledgeMock.mockResolvedValueOnce([
      {
        id: "ki_wifi",
        bodyMd: "El wifi es MyNetwork con clave secret123.",
        entityType: "amenity",
        templateKey: null,
        tags: ["am.wifi"],
        visibility: "internal",
        confidenceScore: 0.9,
      },
    ]);

    const result = await resolveVariables(
      "prop_1",
      "{{wifi_name}} / {{wifi_password}}",
    );
    expect(result.states.wifi_name).toEqual({
      status: "missing",
      label: "Nombre WiFi",
    });
    expect(result.states.wifi_password).toEqual({
      status: "missing",
      label: "Contraseña WiFi",
    });
  });
});
